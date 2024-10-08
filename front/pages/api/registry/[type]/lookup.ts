import type {
  CoreAPISearchFilter,
  Result,
  WithAPIErrorResponse,
} from "@dust-tt/types";
import { Err, groupHasPermission, Ok } from "@dust-tt/types";
import type { NextApiRequest, NextApiResponse } from "next";

import { Authenticator } from "@app/lib/auth";
import { isManaged } from "@app/lib/data_sources";
import { Workspace } from "@app/lib/models/workspace";
import { DataSourceResource } from "@app/lib/resources/data_source_resource";
import { DataSourceViewResource } from "@app/lib/resources/data_source_view_resource";
import { GroupResource } from "@app/lib/resources/group_resource";
import { VaultResource } from "@app/lib/resources/vault_resource";
import logger from "@app/logger/logger";
import { apiError, withLogging } from "@app/logger/withlogging";

const { DUST_REGISTRY_SECRET } = process.env;

type LookupDataSourceResponseBody = {
  project_id: number;
  data_source_id: string;
  view_filter: CoreAPISearchFilter | null;
};

/**
 * Notes about the registry lookup service:
 *
 * For DataSources, we could proxy and modify on the fly the config before going to core and replace
 * workspace_id by the internal dust project id but we'll need the same logic for code blocks
 * to execute other dust apps and won't be able to modify on the fly the code, and will need to do
 * it over API from core to front there, so we might as well handle this consistently.
 *
 * But that means we need to pass through the Dust WorkspaceId (of the executor) as header when
 * going to core so that we can retrieve it here and check that the workspace indeed matches the
 * DataSource's owner workspace. This means you can only use your own workspace's DataSources for
 * now.
 *
 * All of this creates an entanglement between core and front but only through this registry lookup
 * service.
 *
 * Note: there is also a problem with private DataSources on public apps, the use of the registry
 * here will prevent leaking them.
 */
async function handler(
  req: NextApiRequest,
  res: NextApiResponse<WithAPIErrorResponse<LookupDataSourceResponseBody>>
): Promise<void> {
  if (!req.headers.authorization) {
    res.status(401).end();
    return;
  }

  const parse = req.headers.authorization.match(/Bearer ([a-zA-Z0-9]+)/);
  if (!parse || !parse[1]) {
    res.status(401).end();
    return;
  }
  const secret = parse[1];

  if (secret !== DUST_REGISTRY_SECRET) {
    res.status(401).end();
    return;
  }

  const dustWorkspaceId = req.headers["x-dust-workspace-id"];
  const rawDustGroupIds = req.headers["x-dust-group-ids"];
  if (
    typeof dustWorkspaceId !== "string" ||
    typeof rawDustGroupIds !== "string"
  ) {
    return apiError(req, res, {
      status_code: 400,
      api_error: {
        type: "invalid_request_error",
        message: "Missing x-dust-workspace-id or x-dust-group-ids header.",
      },
    });
  }

  // Temporary instrumentation to track the origin of the request.
  const dustOrigin =
    typeof req.headers["x-dust-origin"] === "string"
      ? req.headers["x-dust-origin"]
      : null;

  const dustGroupIds = rawDustGroupIds.split(",");

  switch (req.method) {
    case "GET":
      switch (req.query.type) {
        case "data_sources":
          const notFoundError = () => {
            return apiError(req, res, {
              status_code: 404,
              api_error: {
                type: "data_source_not_found",
                message: "The data source requested was not found.",
              },
            });
          };
          const {
            data_source_id: dataSourceOrDataSourceViewId,
            workspace_id: workspaceId,
          } = req.query;

          if (
            typeof workspaceId !== "string" ||
            typeof dataSourceOrDataSourceViewId !== "string"
          ) {
            return notFoundError();
          }

          const owner = await Workspace.findOne({
            where: {
              sId: workspaceId,
            },
          });
          if (!owner || dustWorkspaceId !== owner.sId) {
            return notFoundError();
          }

          // Use admin auth to fetch the groups.
          const auth =
            await Authenticator.internalAdminForWorkspace(workspaceId);

          const groups = await GroupResource.fetchByIds(auth, dustGroupIds);
          if (groups.isErr()) {
            return notFoundError();
          }

          if (
            DataSourceViewResource.isDataSourceViewSId(
              dataSourceOrDataSourceViewId
            )
          ) {
            const dataSourceViewRes = await handleDataSourceView(
              auth,
              groups.value,
              dataSourceOrDataSourceViewId,
              dustOrigin
            );
            if (dataSourceViewRes.isErr()) {
              logger.info(
                {
                  dataSourceViewId: dataSourceOrDataSourceViewId,
                  err: dataSourceViewRes.error,
                  groups: dustGroupIds,
                  workspaceId: dustWorkspaceId,
                },
                "Failed to lookup data source view."
              );
              return notFoundError();
            }

            res.status(200).json(dataSourceViewRes.value);
            return;
          } else {
            const dataSourceRes = await handleDataSource(
              auth,
              groups.value,
              dataSourceOrDataSourceViewId,
              dustOrigin
            );
            if (dataSourceRes.isErr()) {
              logger.info(
                {
                  dataSourceId: dataSourceOrDataSourceViewId,
                  err: dataSourceRes.error,
                  groups: dustGroupIds,
                  workspaceId: dustWorkspaceId,
                },
                "Failed to lookup data source."
              );
              return notFoundError();
            }

            return res.status(200).json(dataSourceRes.value);
          }

        default:
          return apiError(req, res, {
            status_code: 400,
            api_error: {
              type: "invalid_request_error",
              message: "Unsupported `type` parameter.",
            },
          });
      }

    default:
      return apiError(req, res, {
        status_code: 405,
        api_error: {
          type: "method_not_supported_error",
          message: "The method passed is not supported, POST is expected.",
        },
      });
  }
}

export default withLogging(handler);

async function handleDataSourceView(
  auth: Authenticator,
  groups: GroupResource[],
  dataSourceViewId: string,
  dustOrigin: string | null
): Promise<Result<LookupDataSourceResponseBody, Error>> {
  const dataSourceView = await DataSourceViewResource.fetchById(
    auth,
    dataSourceViewId
  );
  if (!dataSourceView) {
    return new Err(new Error("Data source view not found."));
  }

  // Ensure provided groups can access the data source view.
  const hasAccessToDataSourceView = groups.some((g) =>
    groupHasPermission(dataSourceView.acl(), "read", g.id)
  );
  // TODO(GROUPS_INFRA) Clean up after release.
  if (!hasAccessToDataSourceView) {
    logger.info(
      {
        acl: dataSourceView.acl(),
        dataSourceViewId,
        dustOrigin,
        groups: groups.map((g) => g.id),
      },
      "No access to data source view."
    );
  }

  if (hasAccessToDataSourceView) {
    const { dataSource } = dataSourceView;

    return new Ok({
      project_id: parseInt(dataSource.dustAPIProjectId),
      data_source_id: dataSource.dustAPIDataSourceId,
      view_filter: {
        tags: null,
        parents: {
          in: dataSourceView.parentsIn,
          not: null,
        },
        timestamp: null,
      },
    });
  }

  return new Err(new Error("No access to data source view."));
}

async function handleDataSource(
  auth: Authenticator,
  groups: GroupResource[],
  dataSourceId: string,
  dustOrigin: string | null
): Promise<Result<LookupDataSourceResponseBody, Error>> {
  const dataSource = await DataSourceResource.fetchByNameOrId(
    auth,
    dataSourceId,
    // TODO(DATASOURCE_SID): Clean-up
    { origin: "registry_lookup" }
  );
  if (!dataSource) {
    return new Err(new Error("Data source not found."));
  }

  // Until we pass the data source view id for managed data sources, we need to fetch it here.
  // TODO(2024-08-02 flav) Remove once dust apps rely on the data source view id for managed data sources.
  if (isManaged(dataSource)) {
    const globalVault = await VaultResource.fetchWorkspaceGlobalVault(auth);
    const dataSourceView =
      await DataSourceViewResource.listForDataSourcesInVault(
        auth,
        [dataSource],
        globalVault
      );

    return handleDataSourceView(
      auth,
      groups,
      dataSourceView[0].sId,
      dustOrigin
    );
  }

  const hasAccessToDataSource = groups.some((g) =>
    groupHasPermission(dataSource.acl(), "read", g.id)
  );
  // TODO(GROUPS_INFRA) Clean up after release.
  if (!hasAccessToDataSource) {
    logger.info(
      {
        acl: dataSource.acl(),
        dataSourceId,
        dustOrigin,
        groups: groups.map((g) => g.id),
      },
      "No access to data source."
    );
  }

  if (hasAccessToDataSource) {
    return new Ok({
      project_id: parseInt(dataSource.dustAPIProjectId),
      data_source_id: dataSource.dustAPIDataSourceId,
      view_filter: null,
    });
  }

  return new Err(new Error("No access to data source."));
}

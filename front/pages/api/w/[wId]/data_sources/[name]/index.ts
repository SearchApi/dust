import type { DataSourceType, WithAPIErrorResponse } from "@dust-tt/types";
import type { NextApiRequest, NextApiResponse } from "next";

import {
  deleteDataSource,
  getDataSource,
  MANAGED_DS_DELETABLE_AS_BUILDER,
} from "@app/lib/api/data_sources";
import { withSessionAuthentication } from "@app/lib/api/wrappers";
import { Authenticator, getSession } from "@app/lib/auth";
import { DataSource } from "@app/lib/models/data_source";
import { apiError } from "@app/logger/withlogging";

export type GetOrPostDataSourceResponseBody = {
  dataSource: DataSourceType;
};

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<
    WithAPIErrorResponse<GetOrPostDataSourceResponseBody | void>
  >
): Promise<void> {
  const session = await getSession(req, res);
  const auth = await Authenticator.fromSession(
    session,
    req.query.wId as string
  );

  const owner = auth.workspace();
  if (!owner || !auth.isUser()) {
    return apiError(req, res, {
      status_code: 404,
      api_error: {
        type: "data_source_not_found",
        message: "The data source you requested was not found.",
      },
    });
  }

  if (!req.query.name || typeof req.query.name !== "string") {
    return apiError(req, res, {
      status_code: 404,
      api_error: {
        type: "data_source_not_found",
        message: "The data source you requested was not found.",
      },
    });
  }

  const dataSource = await getDataSource(auth, req.query.name);
  if (!dataSource) {
    return apiError(req, res, {
      status_code: 404,
      api_error: {
        type: "data_source_not_found",
        message: "The data source you requested was not found.",
      },
    });
  }

  switch (req.method) {
    case "GET":
      res.status(200).json({
        dataSource: {
          id: dataSource.id,
          createdAt: dataSource.createdAt,
          name: dataSource.name,
          description: dataSource.description,
          dustAPIProjectId: dataSource.dustAPIProjectId,
          connectorId: dataSource.connectorId,
          connectorProvider: dataSource.connectorProvider,
          assistantDefaultSelected: dataSource.assistantDefaultSelected,
        },
      });
      return;

    case "POST":
      if (!auth.isBuilder()) {
        return apiError(req, res, {
          status_code: 403,
          api_error: {
            type: "data_source_auth_error",
            message:
              "Only the users that are `builders` for the current workspace can update a data source.",
          },
        });
      }

      const dataSourceModel = await DataSource.findByPk(dataSource.id);
      if (!dataSourceModel) {
        return apiError(req, res, {
          status_code: 404,
          api_error: {
            type: "data_source_not_found",
            message: "The data source you requested was not found.",
          },
        });
      }

      let ds: DataSource;
      if (dataSource.connectorId) {
        // managed data source
        if (
          !req.body ||
          typeof req.body.assistantDefaultSelected !== "boolean" ||
          Object.keys(req.body).length !== 1
        ) {
          return apiError(req, res, {
            status_code: 400,
            api_error: {
              type: "invalid_request_error",
              message:
                "Only the assistantDefaultSelected setting can be updated for managed data sources, which must be boolean.",
            },
          });
        }
        ds = await dataSourceModel.update({
          assistantDefaultSelected: req.body.assistantDefaultSelected,
        });
      } else {
        // non-managed data source
        if (
          !req.body ||
          (typeof req.body.description !== "string" &&
            typeof req.body.assistantDefaultSelected !== "boolean")
        ) {
          return apiError(req, res, {
            status_code: 400,
            api_error: {
              type: "invalid_request_error",
              message: "The request body is missing",
            },
          });
        }

        const toUpdate: {
          description?: string | null;
          assistantDefaultSelected?: boolean;
        } = {};

        if (typeof req.body.description === "string") {
          toUpdate.description = req.body.description || null;
        }

        if (typeof req.body.assistantDefaultSelected === "boolean") {
          toUpdate.assistantDefaultSelected = req.body.assistantDefaultSelected;
        }

        ds = await dataSourceModel.update(toUpdate);
      }

      return res.status(200).json({
        dataSource: {
          id: ds.id,
          createdAt: ds.createdAt.getTime(),
          name: ds.name,
          description: ds.description,
          assistantDefaultSelected: ds.assistantDefaultSelected,
          dustAPIProjectId: ds.dustAPIProjectId,
          connectorId: ds.connectorId,
          connectorProvider: ds.connectorProvider,
        },
      });

    case "DELETE":
      if (!auth.isBuilder()) {
        return apiError(req, res, {
          status_code: 403,
          api_error: {
            type: "data_source_auth_error",
            message:
              "Only the users that are `builders` for the current workspace can delete a data source.",
          },
        });
      }

      // We only allow deleteing selected managed data sources as builder.
      if (
        dataSource.connectorId &&
        dataSource.connectorProvider &&
        !MANAGED_DS_DELETABLE_AS_BUILDER.includes(dataSource.connectorProvider)
      ) {
        return apiError(req, res, {
          status_code: 400,
          api_error: {
            type: "invalid_request_error",
            message: "Managed data sources cannot be deleted.",
          },
        });
      }

      const dRes = await deleteDataSource(auth, dataSource.name);
      if (dRes.isErr()) {
        return apiError(req, res, {
          status_code: 500,
          api_error: dRes.error,
        });
      }

      res.status(204).end();
      return;

    default:
      return apiError(req, res, {
        status_code: 405,
        api_error: {
          type: "method_not_supported_error",
          message:
            "The method passed is not supported, GET or POST is expected.",
        },
      });
  }
}

export default withSessionAuthentication(handler);

import type { KeyType, WithAPIErrorResponse } from "@dust-tt/types";
import { isLeft } from "fp-ts/Either";
import * as t from "io-ts";
import type { NextApiRequest, NextApiResponse } from "next";

import { withSessionAuthenticationForWorkspace } from "@app/lib/api/wrappers";
import type { Authenticator } from "@app/lib/auth";
import { GroupResource } from "@app/lib/resources/group_resource";
import { KeyResource } from "@app/lib/resources/key_resource";
import { apiError } from "@app/logger/withlogging";

export type GetKeysResponseBody = {
  keys: KeyType[];
};

export type PostKeysResponseBody = {
  key: KeyType;
};

const CreateKeyPostBodySchema = t.type({
  name: t.string,
  group_id: t.union([t.string, t.undefined]),
});

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<
    WithAPIErrorResponse<GetKeysResponseBody | PostKeysResponseBody>
  >,
  auth: Authenticator
): Promise<void> {
  const user = auth.getNonNullableUser();
  const owner = auth.getNonNullableWorkspace();

  // With Vaults we're moving API keys management to the Admin role.
  const isVaultsFeatureEnabled = owner.flags.includes("data_vaults_feature");
  const hasValidRole = isVaultsFeatureEnabled
    ? auth.isAdmin()
    : auth.isBuilder();

  if (!hasValidRole) {
    const errorMessage = isVaultsFeatureEnabled
      ? "Only the users that are `admins` for the current workspace can interact with keys"
      : "Only the users that are `builders` for the current workspace can interact with keys.";
    return apiError(req, res, {
      status_code: 403,
      api_error: {
        type: "app_auth_error",
        message: errorMessage,
      },
    });
  }

  switch (req.method) {
    case "GET":
      const keys = await KeyResource.listNonSystemKeysByWorkspace(owner);

      res.status(200).json({
        keys: keys.map((k) => k.toJSON()),
      });

      return;

    case "POST":
      const bodyValidation = CreateKeyPostBodySchema.decode(req.body);
      if (isLeft(bodyValidation)) {
        return apiError(req, res, {
          status_code: 404,
          api_error: {
            type: "invalid_request_error",
            message: "Invalid request body",
          },
        });
      }

      const { name, group_id } = bodyValidation.right;
      const group = group_id
        ? await GroupResource.fetchById(auth, group_id)
        : await GroupResource.fetchWorkspaceGlobalGroup(auth);

      if (group.isErr()) {
        return apiError(req, res, {
          status_code: 404,
          api_error: {
            type: "group_not_found",
            message: "Invalid group",
          },
        });
      }

      const key = await KeyResource.makeNew(
        {
          name: name,
          status: "active",
          userId: user.id,
          workspaceId: owner.id,
          isSystem: false,
        },
        group.value
      );

      res.status(201).json({
        key: key.toJSON(),
      });
      return;

    default:
      res.status(405).end();
      return;
  }
}

export default withSessionAuthenticationForWorkspace(handler);

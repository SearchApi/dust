import { CloudArrowLeftRightIcon, Page } from "@dust-tt/sparkle";
import type {
  ConnectorProvider,
  DataSourceViewCategory,
  PlanType,
  VaultType,
} from "@dust-tt/types";
import {
  CONNECTOR_PROVIDERS,
  isConnectorProvider,
  removeNulls,
} from "@dust-tt/types";
import type { InferGetServerSidePropsType } from "next";
import { useRouter } from "next/router";
import type { ReactElement } from "react";

import type { DataSourceIntegration } from "@app/components/vaults/AddConnectionMenu";
import { VaultAppsList } from "@app/components/vaults/VaultAppsList";
import type { VaultLayoutProps } from "@app/components/vaults/VaultLayout";
import { VaultLayout } from "@app/components/vaults/VaultLayout";
import { VaultResourcesList } from "@app/components/vaults/VaultResourcesList";
import config from "@app/lib/api/config";
import {
  augmentDataSourceWithConnectorDetails,
  getDataSources,
} from "@app/lib/api/data_sources";
import { isManaged } from "@app/lib/data_sources";
import { withDefaultUserAuthRequirements } from "@app/lib/iam/session";
import { VaultResource } from "@app/lib/resources/vault_resource";
import type { DataSourceWithConnectorAndUsageType } from "@app/pages/w/[wId]/builder/data-sources/managed";

export const getServerSideProps = withDefaultUserAuthRequirements<
  VaultLayoutProps & {
    category: DataSourceViewCategory;
    dustClientFacingUrl: string;
    isAdmin: boolean;
    canWriteInVault: boolean;
    vault: VaultType;
    systemVault: VaultType;
    plan: PlanType;
    integrations: DataSourceIntegration[];
  }
>(async (context, auth) => {
  const owner = auth.getNonNullableWorkspace();
  const subscription = auth.subscription();
  const plan = auth.getNonNullablePlan();

  if (!subscription) {
    return {
      notFound: true,
    };
  }

  const systemVault = await VaultResource.fetchWorkspaceSystemVault(auth);
  const vault = await VaultResource.fetchById(
    auth,
    context.query.vaultId as string
  );
  if (!vault || !systemVault) {
    return {
      notFound: true,
    };
  }
  const isAdmin = auth.isAdmin();
  const isBuilder = auth.isBuilder();
  const canWriteInVault = vault.canWrite(auth);

  const isSystemVault = vault.kind === "system";
  const integrations: DataSourceIntegration[] = [];

  if (isSystemVault) {
    let setupWithSuffix: {
      connector: ConnectorProvider;
      suffix: string;
    } | null = null;
    if (
      context.query.setupWithSuffixConnector &&
      isConnectorProvider(context.query.setupWithSuffixConnector as string) &&
      context.query.setupWithSuffixSuffix &&
      typeof context.query.setupWithSuffixSuffix === "string"
    ) {
      setupWithSuffix = {
        connector: context.query.setupWithSuffixConnector as ConnectorProvider,
        suffix: context.query.setupWithSuffixSuffix,
      };
    }

    const allDataSources = await getDataSources(auth, {
      includeEditedBy: true,
    });

    const managedDataSources: DataSourceWithConnectorAndUsageType[] =
      removeNulls(
        await Promise.all(
          allDataSources.map(async (managedDataSource) => {
            const ds = managedDataSource.toJSON();
            if (!isManaged(ds)) {
              return null;
            }
            const augmentedDataSource =
              await augmentDataSourceWithConnectorDetails(ds);

            const usageRes = await managedDataSource.getUsagesByAgents(auth);
            return {
              ...augmentedDataSource,
              usage: usageRes.isOk() ? usageRes.value : 0,
            };
          })
        )
      );
    for (const connectorProvider of CONNECTOR_PROVIDERS) {
      if (
        !managedDataSources.find(
          (i) => i.connectorProvider === connectorProvider
        ) ||
        setupWithSuffix?.connector === connectorProvider
      ) {
        integrations.push({
          connectorProvider: connectorProvider,
          setupWithSuffix:
            setupWithSuffix?.connector === connectorProvider
              ? setupWithSuffix.suffix
              : null,
        });
      }
    }
  }

  return {
    props: {
      category: context.query.category as DataSourceViewCategory,
      dustClientFacingUrl: config.getClientFacingUrl(),
      isAdmin,
      isBuilder,
      canWriteInVault,
      owner,
      plan,
      subscription,
      vault: vault.toJSON(),
      systemVault: systemVault.toJSON(),
      integrations,
    },
  };
});

export default function Vault({
  category,
  dustClientFacingUrl,
  isAdmin,
  canWriteInVault,
  owner,
  plan,
  vault,
  systemVault,
  integrations,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const router = useRouter();
  return (
    <Page.Vertical gap="xl" align="stretch">
      {vault.kind === "system" && (
        <Page.Header
          title={"Connection Management"}
          icon={CloudArrowLeftRightIcon}
        />
      )}
      {category === "apps" ? (
        <VaultAppsList
          owner={owner}
          vault={vault}
          canWriteInVault={canWriteInVault}
          onSelect={(sId) => {
            void router.push(`/w/${owner.sId}/vaults/${vault.sId}/apps/${sId}`);
          }}
        />
      ) : (
        <VaultResourcesList
          dustClientFacingUrl={dustClientFacingUrl}
          owner={owner}
          plan={plan}
          vault={vault}
          systemVault={systemVault}
          isAdmin={isAdmin}
          canWriteInVault={canWriteInVault}
          category={category}
          integrations={integrations}
          onSelect={(sId) => {
            void router.push(
              `/w/${owner.sId}/vaults/${vault.sId}/categories/${category}/data_source_views/${sId}`
            );
          }}
        />
      )}
    </Page.Vertical>
  );
}

Vault.getLayout = (page: ReactElement, pageProps: any) => {
  return <VaultLayout pageProps={pageProps}>{page}</VaultLayout>;
};

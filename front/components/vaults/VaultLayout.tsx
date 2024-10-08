import { Breadcrumbs, FolderIcon } from "@dust-tt/sparkle";
import type {
  DataSourceViewCategory,
  DataSourceViewType,
  SubscriptionType,
  VaultType,
  WorkspaceType,
} from "@dust-tt/types";
import type { ComponentType } from "react";
import React, { useMemo, useState } from "react";

import RootLayout from "@app/components/app/RootLayout";
import AppLayout from "@app/components/sparkle/AppLayout";
import { CreateOrEditVaultModal } from "@app/components/vaults/CreateOrEditVaultModal";
import { CATEGORY_DETAILS } from "@app/components/vaults/VaultCategoriesList";
import VaultSideBarMenu from "@app/components/vaults/VaultSideBarMenu";
import { getConnectorProviderLogoWithFallback } from "@app/lib/connector_providers";
import { getDataSourceNameFromView } from "@app/lib/data_sources";
import { useDataSourceViewContentNodes } from "@app/lib/swr/data_source_views";
import { getVaultIcon } from "@app/lib/vaults";

export interface VaultLayoutProps {
  owner: WorkspaceType;
  isAdmin: boolean;
  subscription: SubscriptionType;
  vault: VaultType;
  category?: DataSourceViewCategory;
  dataSourceView?: DataSourceViewType;
  parentId?: string;
}

export function VaultLayout({
  children,
  pageProps,
}: {
  children: React.ReactNode;
  pageProps: VaultLayoutProps;
}) {
  const [showVaultCreationModal, setShowVaultCreationModal] = useState(false);
  const {
    owner,
    isAdmin,
    subscription,
    vault,
    category,
    dataSourceView,
    parentId,
  } = pageProps;

  const isPrivateVaultsEnabled = owner.flags.includes(
    "private_data_vaults_feature"
  );

  return (
    <RootLayout>
      <AppLayout
        subscription={subscription}
        owner={owner}
        navChildren={
          <VaultSideBarMenu
            owner={owner}
            isAdmin={isAdmin}
            isPrivateVaultsEnabled={isPrivateVaultsEnabled}
            setShowVaultCreationModal={setShowVaultCreationModal}
          />
        }
      >
        <VaultBreadCrumbs
          vault={vault}
          category={category}
          owner={owner}
          dataSourceView={dataSourceView}
          parentId={parentId ?? undefined}
        />
        {children}
        {isAdmin && isPrivateVaultsEnabled && (
          <CreateOrEditVaultModal
            owner={owner}
            isOpen={showVaultCreationModal}
            onClose={() => setShowVaultCreationModal(false)}
          />
        )}
      </AppLayout>
    </RootLayout>
  );
}

function VaultBreadCrumbs({
  owner,
  vault,
  category,
  dataSourceView,
  parentId,
}: {
  owner: WorkspaceType;
  vault: VaultType;
  category?: DataSourceViewCategory;
  dataSourceView?: DataSourceViewType;
  parentId?: string;
}) {
  const {
    nodes: [currentFolder],
  } = useDataSourceViewContentNodes({
    owner,
    dataSourceView: parentId ? dataSourceView : undefined,
    internalIds: parentId ? [parentId] : [],
  });

  const { nodes: folders } = useDataSourceViewContentNodes({
    dataSourceView: currentFolder ? dataSourceView : undefined,
    internalIds: currentFolder?.parentInternalIds ?? [],
    owner,
  });

  const items: {
    label: string;
    icon?: ComponentType;
    href?: string;
  }[] = useMemo(() => {
    if (!category) {
      return [];
    }

    const items = [
      {
        icon: getVaultIcon(vault),
        label: vault.kind === "global" ? "Company Data" : vault.name,
        href: `/w/${owner.sId}/vaults/${vault.sId}`,
      },
      {
        icon: CATEGORY_DETAILS[category].icon,
        label: CATEGORY_DETAILS[category].label,
        href: `/w/${owner.sId}/vaults/${vault.sId}/categories/${category}`,
      },
    ];

    if (vault.kind === "system") {
      if (!dataSourceView) {
        return [];
      }

      // For system vault, we don't want the first breadcrumb to show, since
      // it's only used to manage "connected data" already. Otherwise it would
      // expose a useless link, and name would be redundant with the "Connected
      // data" label
      items.shift();
    }

    if (dataSourceView) {
      if (category === "managed" && vault.kind !== "system") {
        // Remove the "Connected data" from breadcrumbs to avoid hiding the actual
        // managed connection name

        // Showing the actual managed connection name (e.g. microsoft, slack...) is
        // more important and implies clearly that we are dealing with connected
        // data
        items.pop();
      }

      items.push({
        icon: getConnectorProviderLogoWithFallback(
          dataSourceView.dataSource.connectorProvider,
          FolderIcon
        ),
        label: getDataSourceNameFromView(dataSourceView),
        href: `/w/${owner.sId}/vaults/${vault.sId}/categories/${category}/data_source_views/${dataSourceView.sId}`,
      });

      for (const node of [...folders].reverse()) {
        items.push({
          label: node.title,
          href: `/w/${owner.sId}/vaults/${vault.sId}/categories/${category}/data_source_views/${dataSourceView.sId}?parentId=${node.internalId}`,
          icon: FolderIcon,
        });
      }
    }
    return items;
  }, [owner, vault, category, dataSourceView, folders]);

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="pb-8">
      <Breadcrumbs items={items} />
    </div>
  );
}

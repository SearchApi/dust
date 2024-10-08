import { ContentMessage, Modal, Page, SlackLogo } from "@dust-tt/sparkle";
import type {
  BaseContentNode,
  ConnectorPermission,
  DataSourceViewType,
  WorkspaceType,
} from "@dust-tt/types";
import { useCallback, useEffect, useState } from "react";
import React from "react";

import { DataSourcePermissionTreeChildren } from "@app/components/ConnectorPermissionsTree";
import { useConnectorPermissions } from "@app/lib/swr/connectors";

export type SlackChannel = { slackChannelId: string; slackChannelName: string };

interface SlacIntegrationProps {
  existingSelection: SlackChannel[];
  onSelectionChange: (channels: SlackChannel[]) => void;
  owner: WorkspaceType;
  slackDataSourceView: DataSourceViewType;
}

export function SlackIntegration({
  existingSelection,
  onSelectionChange,
  owner,
  slackDataSourceView,
}: SlacIntegrationProps) {
  const [newSelection, setNewSelection] = useState<SlackChannel[]>([]);

  useEffect(() => {
    if (existingSelection.length > 0 && newSelection.length === 0) {
      setNewSelection(existingSelection);
    }
  }, [existingSelection, newSelection]);

  const customIsNodeChecked = useCallback(
    (node: BaseContentNode) => {
      return (
        newSelection?.some((c) => c.slackChannelId === node.internalId) || false
      );
    },
    [newSelection]
  );

  const handlePermissionUpdate = useCallback(
    (
      node: BaseContentNode,
      { newPermission }: { newPermission: ConnectorPermission }
    ) => {
      const { internalId, title } = node;

      setNewSelection((prevSelection) => {
        const channel = { slackChannelId: internalId, slackChannelName: title };
        const index = prevSelection.findIndex(
          (c) => c.slackChannelId === internalId
        );

        if (newPermission === "read_write" && index === -1) {
          return [...prevSelection, channel];
        }

        if (newPermission !== "read_write" && index !== -1) {
          return prevSelection.filter((_, i) => i !== index);
        }

        return prevSelection;
      });
    },
    [setNewSelection]
  );

  // Notify parent component when newSelection changes.
  useEffect(() => {
    if (newSelection !== null) {
      onSelectionChange(newSelection);
    }
  }, [newSelection, onSelectionChange]);

  return (
    <DataSourcePermissionTreeChildren
      owner={owner}
      dataSource={slackDataSourceView.dataSource}
      parentId={null}
      // The "write" permission filter is applied to retrieve all available channels on Slack,
      // not limited to those synced with Dust.
      permissionFilter="write"
      canUpdatePermissions={true}
      onPermissionUpdate={handlePermissionUpdate}
      showExpand={false}
      isSearchEnabled={false}
      customIsNodeChecked={customIsNodeChecked}
      useConnectorPermissionsHook={useConnectorPermissions}
      viewType="documents"
    />
  );
}

interface SlackAssistantDefaultManagerProps {
  assistantHandle?: string;
  existingSelection: SlackChannel[];
  isAdmin: boolean;
  onClose: () => void;
  onSave: (channels: SlackChannel[]) => void;
  owner: WorkspaceType;
  show: boolean;
  slackDataSourceView: DataSourceViewType;
}

export function SlackAssistantDefaultManager({
  assistantHandle,
  existingSelection,
  isAdmin,
  onClose,
  onSave,
  owner,
  show,
  slackDataSourceView,
}: SlackAssistantDefaultManagerProps) {
  const [selectedChannels, setSelectedChannels] =
    useState<SlackChannel[]>(existingSelection);
  const [hasChanged, setHasChanged] = useState(false);

  const handleSelectionChange = (newSelection: SlackChannel[]) => {
    setSelectedChannels(newSelection);
    setHasChanged(true);
  };

  const saveChanges = () => {
    onSave(selectedChannels);
    setHasChanged(false);
    onClose();
  };

  return (
    <>
      <Modal
        hasChanged={hasChanged}
        isOpen={show}
        onClose={onClose}
        onSave={saveChanges}
        title="Slack Integration"
        variant="side-sm"
      >
        <div className="pt-8">
          <Page.Vertical gap="lg" align="stretch">
            <div className="flex flex-col gap-y-2">
              <div className="grow text-sm font-medium text-element-800">
                <SlackLogo className="h-8 w-8" />
              </div>

              <div className="text-sm font-normal text-element-900">
                Set this assistant as the default assistant on one or several of
                your Slack channels. It will answer by default when the{" "}
                <span className="font-bold">{assistantHandle}</span> Slack bot
                is mentionned in these channels.
              </div>

              {!isAdmin && (
                <ContentMessage
                  size="md"
                  variant="pink"
                  title="Admin Access Required"
                >
                  <p>
                    Only administrators can enable default assistants for
                    specific Slack channels.
                  </p>
                </ContentMessage>
              )}

              {isAdmin && (
                <SlackIntegration
                  existingSelection={existingSelection}
                  onSelectionChange={handleSelectionChange}
                  owner={owner}
                  slackDataSourceView={slackDataSourceView}
                />
              )}
            </div>
          </Page.Vertical>
        </div>
      </Modal>
    </>
  );
}

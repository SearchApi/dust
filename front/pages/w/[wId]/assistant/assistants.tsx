import {
  Avatar,
  BookOpenIcon,
  Button,
  ContextItem,
  Page,
  PencilSquareIcon,
  PlusIcon,
  RobotIcon,
  Searchbar,
  Tab,
  Tooltip,
  XMarkIcon,
} from "@dust-tt/sparkle";
import {
  AgentConfigurationType,
  UserType,
  WorkspaceType,
} from "@dust-tt/types";
import { SubscriptionType } from "@dust-tt/types";
import { GetServerSideProps, InferGetServerSidePropsType } from "next";
import Link from "next/link";
import { useState } from "react";

import {
  DeleteAssistantDialog,
  RemoveAssistantFromListDialog,
} from "@app/components/assistant/AssistantActions";
import { AssistantSidebarMenu } from "@app/components/assistant/conversation/SidebarMenu";
import AppLayout from "@app/components/sparkle/AppLayout";
import {
  subNavigationAssistants,
  subNavigationConversations,
} from "@app/components/sparkle/navigation";
import { Authenticator, getSession, getUserFromSession } from "@app/lib/auth";
import { useAgentConfigurations } from "@app/lib/swr";
import { classNames, subFilter } from "@app/lib/utils";

const { GA_TRACKING_ID = "" } = process.env;

const PERSONAL_ASSISTANTS_VIEWS = ["personal", "workspace"] as const;
export type PersonalAssitsantsView = (typeof PERSONAL_ASSISTANTS_VIEWS)[number];

export const getServerSideProps: GetServerSideProps<{
  user: UserType;
  owner: WorkspaceType;
  subscription: SubscriptionType;
  view: PersonalAssitsantsView;
  gaTrackingId: string;
}> = async (context) => {
  const session = await getSession(context.req, context.res);

  const user = await getUserFromSession(session);
  const auth = await Authenticator.fromSession(
    session,
    context.params?.wId as string
  );

  const owner = auth.workspace();
  const subscription = auth.subscription();
  if (!owner || !user || !auth.isUser() || !subscription) {
    return {
      notFound: true,
    };
  }

  const view = PERSONAL_ASSISTANTS_VIEWS.includes(
    context.query.view as PersonalAssitsantsView
  )
    ? (context.query.view as PersonalAssitsantsView)
    : "personal";

  return {
    props: {
      user,
      owner,
      subscription,
      view,
      gaTrackingId: GA_TRACKING_ID,
    },
  };
};

export default function PersonalAssistants({
  user,
  owner,
  subscription,
  view,
  gaTrackingId,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const { agentConfigurations, mutateAgentConfigurations } =
    useAgentConfigurations({
      workspaceId: owner.sId,
      agentsGetView: "list",
    });

  const [assistantSearch, setAssistantSearch] = useState<string>("");

  const viewAssistants = agentConfigurations.filter((a) => {
    if (view === "personal") {
      return a.scope === "private" || a.scope === "published";
    }
    if (view === "workspace") {
      return a.scope === "workspace" || a.scope === "global";
    }
  });

  const filtered = viewAssistants.filter((a) => {
    return subFilter(assistantSearch.toLowerCase(), a.name.toLowerCase());
  });

  const [showRemovalModal, setShowRemovalModal] =
    useState<AgentConfigurationType | null>(null);
  const [showDeletionModal, setShowDeletionModal] =
    useState<AgentConfigurationType | null>(null);

  const tabs = [
    {
      label: "Personal",
      href: `/w/${owner.sId}/assistant/assistants?view=personal`,
      current: view === "personal",
    },
    {
      label: "From Workspace",
      href: `/w/${owner.sId}/assistant/assistants?view=workspace`,
      current: view === "workspace",
    },
  ];

  return (
    <AppLayout
      subscription={subscription}
      user={user}
      owner={owner}
      gaTrackingId={gaTrackingId}
      topNavigationCurrent={
        owner.role === "user" ? "conversations" : "assistants"
      }
      subNavigation={
        owner.role === "user"
          ? subNavigationConversations({
              owner,
              current: "personal_assistants",
            })
          : subNavigationAssistants({
              owner,
              current: "personal_assistants",
            })
      }
      navChildren={
        owner.role === "user" && (
          <AssistantSidebarMenu owner={owner} triggerInputAnimation={null} />
        )
      }
    >
      {showRemovalModal && (
        <RemoveAssistantFromListDialog
          owner={owner}
          agentConfiguration={showRemovalModal}
          show={!!showRemovalModal}
          onClose={() => setShowRemovalModal(null)}
          onRemove={() => {
            void mutateAgentConfigurations();
          }}
        />
      )}
      {showDeletionModal && (
        <DeleteAssistantDialog
          owner={owner}
          agentConfigurationId={showDeletionModal.sId}
          show={!!showDeletionModal}
          onClose={() => setShowDeletionModal(null)}
          onDelete={() => {
            void mutateAgentConfigurations();
          }}
          isPrivateAssistant={true}
        />
      )}

      <Page.Vertical gap="xl" align="stretch">
        <Page.Header
          title="Manage my assistants"
          icon={RobotIcon}
          description="Manage your list of assistants, create and discover new ones."
        />
        <Page.Vertical gap="lg" align="stretch">
          <Tab tabs={tabs} />
          <Page.Vertical gap="md" align="stretch">
            <div className="flex flex-row gap-2">
              <div className="flex w-full flex-1">
                <div className="w-full">
                  <Searchbar
                    name="search"
                    placeholder="Assistant Name"
                    value={assistantSearch}
                    onChange={(s) => {
                      setAssistantSearch(s);
                    }}
                  />
                </div>
              </div>
              <Button.List>
                <Link
                  href={`/w/${owner.sId}/assistant/gallery?flow=personal_add`}
                >
                  <Button
                    variant="primary"
                    icon={BookOpenIcon}
                    label="Add from gallery"
                  />
                </Link>
                {view !== "workspace" && viewAssistants.length > 0 && (
                  <Tooltip label="Create your own assistant">
                    <Link
                      href={`/w/${owner.sId}/builder/assistants/new?flow=my_assistants`}
                    >
                      <Button variant="primary" icon={PlusIcon} label="New" />
                    </Link>
                  </Tooltip>
                )}
              </Button.List>
            </div>

            {view === "workspace" || viewAssistants.length > 0 ? (
              <ContextItem.List className="text-element-900">
                {filtered.map((agent) => (
                  <ContextItem
                    key={agent.sId}
                    title={`@${agent.name}`}
                    visual={
                      <Avatar
                        visual={<img src={agent.pictureUrl} />}
                        size={"sm"}
                      />
                    }
                    action={
                      agent.scope !== "global" && (
                        <div className="flex gap-2">
                          <Link
                            href={`/w/${owner.sId}/builder/assistants/${agent.sId}?flow=my_assistants`}
                          >
                            <Button
                              variant="tertiary"
                              icon={PencilSquareIcon}
                              label="Edit"
                              size="xs"
                              disabled={agent.scope === "workspace"}
                            />
                          </Link>

                          <Button
                            variant="tertiary"
                            icon={XMarkIcon}
                            label="Remove from my list"
                            labelVisible={false}
                            onClick={() => {
                              agent.scope === "private"
                                ? setShowDeletionModal(agent)
                                : setShowRemovalModal(agent);
                            }}
                            size="xs"
                          />
                        </div>
                      )
                    }
                  >
                    <ContextItem.Description>
                      <div className="text-element-700">
                        {agent.description}
                      </div>
                    </ContextItem.Description>
                  </ContextItem>
                ))}
              </ContextItem.List>
            ) : (
              <div
                className={classNames(
                  "relative mt-4 flex h-full min-h-48 items-center justify-center rounded-lg bg-structure-50"
                )}
              >
                <Link
                  href={`/w/${owner.sId}/builder/assistants/new?flow=my_assistants`}
                >
                  <Button
                    size="sm"
                    label="Create an Assistant"
                    variant="primary"
                    icon={PlusIcon}
                  />
                </Link>
              </div>
            )}
          </Page.Vertical>
        </Page.Vertical>
      </Page.Vertical>
    </AppLayout>
  );
}

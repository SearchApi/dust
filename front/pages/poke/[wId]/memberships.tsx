import type {
  MembershipInvitationType,
  UserTypeWithWorkspaces,
  WorkspaceType,
} from "@dust-tt/types";
import type { UserType } from "@dust-tt/types";
import type { InferGetServerSidePropsType } from "next";
import React from "react";

import { InvitationsDataTable } from "@app/components/poke/invitations/table";
import { MembersDataTable } from "@app/components/poke/members/table";
import PokeNavbar from "@app/components/poke/PokeNavbar";
import { getPendingInvitations } from "@app/lib/api/invitation";
import { getMembers } from "@app/lib/api/workspace";
import { withSuperUserAuthRequirements } from "@app/lib/iam/session";

export const getServerSideProps = withSuperUserAuthRequirements<{
  members: UserTypeWithWorkspaces[];
  pendingInvitations: MembershipInvitationType[];
  owner: WorkspaceType;
  user: UserType;
}>(async (context, auth) => {
  const owner = auth.workspace();
  const user = auth.user();

  if (!owner || !user) {
    return {
      notFound: true,
    };
  }

  const [{ members }, pendingInvitations] = await Promise.all([
    getMembers(auth),
    getPendingInvitations(auth),
  ]);

  return {
    props: {
      members,
      pendingInvitations,
      owner,
      user,
    },
  };
});

const MembershipsPage = ({
  members,
  pendingInvitations,
  owner,
  user,
}: InferGetServerSidePropsType<typeof getServerSideProps>) => {
  return (
    <div className="min-h-screen bg-structure-50">
      <PokeNavbar />
      <div className="flex-grow p-6">
        <h1 className="mb-8 text-2xl font-bold">{owner.name}</h1>
        <div className="flex justify-center">
          <MembersDataTable members={members} owner={owner} user={user} />
        </div>
        <div className="flex justify-center">
          <InvitationsDataTable
            invitations={pendingInvitations}
            owner={owner}
          />
        </div>
      </div>
    </div>
  );
};

export default MembershipsPage;

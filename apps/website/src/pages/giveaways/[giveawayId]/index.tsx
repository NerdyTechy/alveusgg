import React from "react";
import type {
  NextPage,
  InferGetServerSidePropsType,
  GetServerSideProps,
} from "next";
import { getSession } from "next-auth/react";

import type { Giveaway, GiveawayEntry, MailingAddress } from "@prisma/client";
import { prisma } from "@/server/db/client";

import { GiveawayEntryForm } from "@/components/giveaway/GiveawayEntryForm";
import Heading from "@/components/content/Heading";
import Section from "@/components/content/Section";
import Meta from "@/components/content/Meta";

export type GiveawayPageProps = InferGetServerSidePropsType<
  typeof getServerSideProps
>;

async function findActiveGiveaway(giveawaySlugOrId: string) {
  const now = new Date();
  return await prisma.giveaway.findFirst({
    where: {
      active: true,
      startAt: { lt: now },
      AND: [
        { OR: [{ endAt: null }, { endAt: { gt: now } }] },
        { OR: [{ id: giveawaySlugOrId }, { slug: giveawaySlugOrId }] },
      ],
    },
  });
}

export type GiveawayEntryWithAddress = GiveawayEntry & {
  mailingAddress: MailingAddress;
};

export const getServerSideProps: GetServerSideProps<{
  giveaway: Giveaway;
  existingEntry: GiveawayEntryWithAddress | null;
}> = async (context) => {
  // Check params
  const giveawaySlugOrId = context.params?.giveawayId;
  if (typeof giveawaySlugOrId !== "string") {
    return {
      notFound: true,
    };
  }

  // Find the giveaway
  const giveaway = await findActiveGiveaway(giveawaySlugOrId);
  if (!giveaway) {
    return {
      notFound: true,
    };
  }

  // Require active session or redirect to log in
  let existingEntry: GiveawayEntryWithAddress | null = null;
  const session = await getSession(context);
  if (session?.user?.id) {
    existingEntry = await prisma.giveawayEntry.findUnique({
      where: {
        giveawayId_userId: {
          userId: session.user.id,
          giveawayId: giveaway.id,
        },
      },
      include: {
        mailingAddress: true,
      },
    });
  }

  return {
    props: { giveaway, existingEntry },
  };
};

const GiveawayPage: NextPage<GiveawayPageProps> = ({
  giveaway,
  existingEntry,
}) => (
  <>
    <Meta
      title={`${giveaway.label} | Giveaways`}
      description={`Check out the ${giveaway.label} giveaway at Alveus.`}
    />

    {/* Nav background */}
    <div className="-mt-40 hidden h-40 bg-alveus-green-900 lg:block" />

    {/* Grow the last section to cover the page */}
    <Section className="flex-grow" containerClassName="max-w-lg">
      <header>
        <Heading className="my-3 text-3xl">{giveaway.label}</Heading>
      </header>

      <GiveawayEntryForm giveaway={giveaway} existingEntry={existingEntry} />
    </Section>
  </>
);

export default GiveawayPage;

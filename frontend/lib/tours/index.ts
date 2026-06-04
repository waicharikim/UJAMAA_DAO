// Registry of all contextual tours. Each `key` must match a seeded OnboardingTutorial
// (category TOUR) so completion + rewards work via the existing onboarding service.
//
// Tours are SHORT orientation, not deep lessons. They teach the concept, flag what's
// gated (and how to unlock it via verification / earning PR), and link to the Education
// library for anyone who wants to go deeper. They never force a gated action.

import type { TourDefinition } from "./types"

const LEARN = (href = "/education") => ({ href, label: "Learn more" })

export const dashboardTour: TourDefinition = {
  key: "dashboard_tour",
  label: "Tour the home feed",
  steps: [
    {
      element: '[data-tour="feed-filters"]',
      title: "Where you're looking",
      description:
        "This is Jamii — your community feed. Switch between your ward, constituency, county, or all of Kenya. Everything below, and anything you post, follows your choice here.",
      side: "bottom",
    },
    {
      element: '[data-tour="feed-compose"]',
      title: "Speak to your community",
      description:
        "Share a notice, an announcement, or a useful resource. Posting opens up once you're community-verified — you can do that from your profile.",
      side: "bottom",
    },
    {
      element: '[data-tour="quick-actions"]',
      title: "Take action",
      description:
        "Shortcuts to start a proposal, explore your groups, or see who's contributing most in your community.",
      side: "top",
      learnMore: LEARN(),
    },
  ],
}

export const communityTour: TourDefinition = {
  key: "community_tour",
  label: "Tour your community",
  steps: [
    {
      element: '[data-tour="community-hero"]',
      title: "Your ward is a governance unit",
      description:
        "Not symbolically — really. What you propose here is real, what you vote on is binding, and what you fund belongs to your ward. You're automatically part of your ward, constituency, county, and national communities.",
      side: "bottom",
      learnMore: LEARN(),
    },
    {
      element: '[data-tour="community-tabs"]',
      title: "Everything your community does",
      description:
        "Feed, proposals, treasury, and members — for whichever level you're viewing. Move up the hierarchy (ward → constituency → county) to see the wider picture.",
      side: "bottom",
    },
    {
      element: '[data-tour="community-create-group"]',
      title: "Start a group",
      description:
        "Beyond your ward, you can create a voluntary group — a SACCO, a youth organisation, a watchdog — with its own treasury and decisions. Creating one costs 100 PR, which you earn by participating.",
      side: "left",
    },
  ],
}

export const governanceTour: TourDefinition = {
  key: "governance_tour",
  label: "Tour governance",
  steps: [
    {
      element: '[data-tour="create-proposal"]',
      title: "Propose what your community needs",
      description:
        "A borehole, a repair, a new rule. Proposing requires community verification, and costs a little PR (earned by showing up). A leader forwards it for review before the community votes.",
      side: "bottom",
    },
    {
      element: '[data-tour="proposal-list"]',
      title: "Decide together",
      description:
        "Every proposal your community is weighing. Open one to read its reasoning, see the community's deliberation, and vote. Your vote is weighted by your Participation Rights — influence comes from contribution, not wealth.",
      side: "top",
      learnMore: LEARN(),
    },
  ],
}

export const profileTour: TourDefinition = {
  key: "profile_tour",
  label: "Tour your profile",
  steps: [
    {
      element: '[data-tour="verification"]',
      title: "Verify to unlock the platform",
      description:
        "Verification is a ladder: phone → community vouching (3 neighbours vouch for you) → full. Each rung unlocks more — voting, the economy, posting. This is how trust scales beyond people you already know.",
      side: "bottom",
      learnMore: LEARN(),
    },
    {
      element: '[data-tour="getting-started"]',
      title: "Your first steps",
      description:
        "A short checklist to get going. Each step you complete earns Participation Rights — your voice in governance, which you can never buy or sell.",
      side: "top",
    },
  ],
}

export const projectsTour: TourDefinition = {
  key: "projects_tour",
  label: "Tour projects",
  steps: [
    {
      element: '[data-tour="projects-cta"]',
      title: "Projects come from proposals",
      description:
        "A project starts life as an approved governance proposal. The community decides it's worth doing — then it becomes a project to build and fund together.",
      side: "bottom",
    },
    {
      element: '[data-tour="projects-list"]',
      title: "Build and track",
      description:
        "Each active project, its milestones, and its team. Contributing work — verified through QR check-ins at the site — earns you Impact Points.",
      side: "top",
      learnMore: LEARN(),
    },
  ],
}

export const marketplaceTour: TourDefinition = {
  key: "marketplace_tour",
  label: "Tour the marketplace",
  steps: [
    {
      element: '[data-tour="marketplace-filters"]',
      title: "Find what you need",
      description:
        "Browse offers and requests for goods and services from members. The marketplace is discovery only — it connects people. Deals happen directly between you, via M-Pesa, never inside the app.",
      side: "bottom",
    },
    {
      element: '[data-tour="marketplace-create"]',
      title: "List your own",
      description:
        "Community-verified members can post what they offer or need. Browsing is free for everyone; listing needs verification.",
      side: "left",
    },
  ],
}

export const educationTour: TourDefinition = {
  key: "education_tour",
  label: "Tour learning",
  steps: [
    {
      element: '[data-tour="education-filters"]',
      title: "Learn everything, at your pace",
      description:
        "This is the library. Filter modules by difficulty and topic — governance, finance, civic skills, safety, and more. Start anywhere.",
      side: "bottom",
    },
    {
      element: '[data-tour="education-modules"]',
      title: "Learn and earn",
      description:
        "Complete a module to earn Impact Points. This is where individual effort becomes collective capability — and the deepest answers to 'how does all this work' live right here.",
      side: "top",
    },
  ],
}

export const treasuryTour: TourDefinition = {
  key: "treasury_tour",
  label: "Tour the treasury",
  steps: [
    {
      element: '[data-tour="treasury-overview"]',
      title: "Your ward's money, in the open",
      description:
        "The collective funds of your ward. Nobody controls it alone — not the ward admin, not the platform. It moves only by the community's vote, and every shilling in and out is on the record.",
      side: "bottom",
      learnMore: LEARN(),
    },
    {
      element: '[data-tour="treasury-fund"]',
      title: "Contribute",
      description:
        "Add funds to a group's treasury via M-Pesa — real money on regulated rails, never person-to-person inside the app. Twenty neighbours at 200 bob each is how the borehole gets built.",
      side: "left",
    },
  ],
}

export const electionsTour: TourDefinition = {
  key: "elections_tour",
  label: "Tour elections",
  steps: [
    {
      element: '[data-tour="elections-tabs"]',
      title: "Community leadership",
      description:
        "Leaders are chosen by the community, transparently. Filter elections by stage — nominations open, voting open, or closed.",
      side: "bottom",
    },
    {
      element: '[data-tour="elections-list"]',
      title: "Nominate and vote",
      description:
        "Open an election to nominate someone, stand yourself, or cast your vote. Nominating carries a small PR fee — to keep it serious.",
      side: "top",
      learnMore: LEARN(),
    },
  ],
}

export const emergencyTour: TourDefinition = {
  key: "emergency_tour",
  label: "Tour emergency",
  steps: [
    {
      element: '[data-tour="emergency-report"]',
      title: "Raise the alarm",
      description:
        "Report an urgent issue — fire, flood, medical, security — so your ward can coordinate a fast response. Anyone can report; you don't need to be verified for emergencies.",
      side: "left",
    },
    {
      element: '[data-tour="emergency-list"]',
      title: "Active alerts",
      description:
        "What's happening in your ward right now. The reporter's identity is always protected.",
      side: "top",
    },
  ],
}

export const proposalDetailTour: TourDefinition = {
  key: "proposal_detail_tour",
  label: "How to read & vote on a proposal",
  steps: [
    {
      element: '[data-tour="proposal-body"]',
      title: "Read the full picture",
      description:
        "The proposal itself — what's being asked, why, and what alternatives were weighed. Take your time; this is your ward's decision.",
      side: "bottom",
      learnMore: LEARN(),
    },
    {
      element: '[data-tour="proposal-deliberation"]',
      title: "See what people think",
      description:
        "The community's deliberation — the most-reacted opinions and, once voting opens, a neutral digest of the discussion. It informs your vote; it never makes it for you.",
      side: "top",
    },
    {
      element: '[data-tour="proposal-vote"]',
      title: "Cast your vote",
      description:
        "Vote yes, no, or abstain. Voting needs community verification, and your weight reflects your Participation Rights. The result is binding and recorded permanently.",
      side: "top",
    },
  ],
}

export const ALL_TOURS: TourDefinition[] = [
  dashboardTour,
  communityTour,
  governanceTour,
  profileTour,
  projectsTour,
  marketplaceTour,
  educationTour,
  treasuryTour,
  electionsTour,
  emergencyTour,
  proposalDetailTour,
]

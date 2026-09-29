# Content sources and publication notes

Last checked: September 28, 2026. This file records the evidence used for the first public English content pages. It is a maintainer note; the website does not claim that every listed product or reward detail has been independently verified.

## Claim register

| Public claim | Source and type | Status and limits | Used on |
| --- | --- | --- | --- |
| Muse is Meta's personal AI agent; the September 8, 2026 launch announcement links to muse.ai and says the rollout is in the United States on iOS, Android, and muse.ai. | [Meta Newsroom, “Introducing Muse”](https://about.fb.com/news/2026/09/introducing-muse-personal-ai-agent/) — official, published September 8, 2026. | The announcement is a dated launch snapshot. It is not a current account-level eligibility checker or a complete, continuously updated country list. | how-to-register, region-limits |
| muse.ai is the official Muse entry point linked by Meta. | Meta Newsroom link above — official link. | Direct browser inspection on September 28, 2026 redirected to an auth.muse.ai URL that this browser reader could not open. The link target is official; the current enrollment screens and eligibility steps were not verified. | how-to-register, region-limits |
| A reward redemption window of 48 hours after joining, up to 1 billion tokens for each side, up to 30 uses per code, and one invite reward per recipient. | User-provided community-rule summary in the owner’s privately retained Spec v1.2, §1.1. No official source supplied. | Community-reported; not independently verified. The event that starts the 48-hour window is unknown. These are not promises or an eligibility check. Pages direct visitors to current in-app terms. | redeem, how-to-register |
| Settings → General → Redeem Invite Code is a reported redemption path. | User-provided v1.1 route retained in Spec v1.2, §1.1; no current screenshots supplied. | Not screenshot-verified on web, iOS, or Android. Do not present as a confirmed current route; wording labels it as a previously reported path and directs readers to follow their current interface. | redeem |
| On September 28, 2026, the site owner used a third-party cloud browser to sign in to an existing waitlisted account, completed Muse's displayed verification, sent a web-session message, and then found the same account usable in the iOS app. | First-person report in the owner’s privately retained source notes dated 2026-09-28, §2. | Owner-confirmed, single attempt; not independently verified or repeated. No causation is established. Lexmount's relationship with Meta is unverified. Do not turn it into a general access method or recommendation. | how-to-register, region-limits |
| Muse Invite Hub is independent, uses museinvitehub.org, and publishes support@museinvitehub.org. | User-confirmed project facts in Spec v1.2, §13.1. | Domain registration was reported by the user; DNS, HTTPS, deployment, and support-mail delivery were not verified by this content task. The private administrator address is intentionally excluded. | about, contact, privacy, terms |
| The site uses an anonymous browser identifier, keyed abuse-prevention summaries, public code records, current feedback, and the listed retention periods. | Product data policy in Spec v1.2, §§5, 7, and 12. | Public privacy copy describes the approved design. Production database retention, scheduled cleanup, provider logs, and storage behavior still require implementation and release verification. | privacy |
| GA4 uses advanced Consent Mode, starts all four consent states denied, is limited to public pages, and does not send code text or management credentials. | Spec v1.2, §12.1. | Measurement ID and production property are not yet configured. Verify actual scripts, event parameters, region handling, and stored choices before launch. | privacy |

## Editorial rules

- Keep official product information, the site owner's first-person account, and community reports visually and verbally distinct.
- Do not describe community-reported reward values or limits as official, verified, guaranteed, or currently valid.
- Do not imply that a reward invite code is needed to register, join a waitlist, or obtain account access.
- Do not recommend fabricated identity, age, location, address, payment details, VPN use, or other eligibility workarounds.
- Do not claim that the reported browser session caused account access or that the experience generalizes to other people.
- Do not imply that a “Didn't work” report proves a code is full, invalid for everyone, or at a particular remaining capacity.
- The public contact is support@museinvitehub.org. Never publish the private administrator email, management tokens, visitor digests, or security configuration.
- Only add public pages to the sitemap after they are live, indexable, canonical, and return a successful response. The current sitemap list includes the specified home/share routes and seven content routes; private management, admin, API, and deferred content pages are excluded.
- The robots file allows public crawling and points to the sitemap. Private management and admin surfaces still need their own noindex/no-store protections; robots rules are not an access-control or noindex substitute.
- Recheck source-backed claims when Meta updates availability or when the site receives new evidence. Do not invent a review date, screenshots, usage numbers, or success rate.

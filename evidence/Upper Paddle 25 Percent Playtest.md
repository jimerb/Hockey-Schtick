# Upper paddle offense — local playtest

The upper paddle length is increased by 25% from the released 0.4.8 size: 2.035 → 2.54375. The pivot, width, stroke angles and paired A/L controls are retained. The visible blade, physical rounded tip, board recess and resting insert use the shared length, so the longer blade remains recessed while idle and leaves the board glide open.

Upper and lower paddles now use the same swept-contact checking path. An upper powered stroke can interrupt a skater's play and push it a short distance along its existing rail. Strength comes from actual closing speed and the contact's rail component; stick hits transfer less force than torso hits. The contact direction determines the upper shove direction, with the same 0.95 maximum displacement, smooth easing, recovery, cooldown, check sound and cyan marker. Held and returning paddles cannot repeatedly pump a skater. Each of the four paddles tracks its own contact/stroke state.

At this length and the existing angle, the two normal wing fixtures are reached through their outward-facing sticks. Their mirrored physical hits each produced a 0.38547 rail shove. This confirms an actual stick contact can move the whole skater; it does not add a distant or automatic check. The normal lower body/stick checks retain their previous measured response.

## Verification

- Production build and whitespace check passed. The existing shared-bundle size warning remains.
- 64 offense checks passed, including 25% size, added tip reach, idle board clearance, goals, hold/release behavior and full-team containment.
- All 464 paddle-integrity cases passed for both pairs, including flat/hopping pucks, deep overlaps, holds, returns and fast contacts.
- All 30 existing lower-checking cases passed, including weaker taps/stick hits, interrupted attacks, rail limits, rematch cleanup and full-team scrambles.
- 14 new upper-check cases passed: mirrored actual contacts and displacement, smooth rail motion, cooldown and held/return exclusions, reach limits, disabled checks, no remote puck kick, rail-end clamping, reset and live containment. The free-running one-minute rally produced no upper checks; the parked normal-rail fixtures are the evidence for upper contact behavior.
- Isolated real WebGL inspection confirmed both longer recessed faces and the extended blades. A real upper contact triggered the existing check sound and checked state. Browser errors: zero. The screenshot shows the contact pose; the numeric cases separately verify the ensuing shove.

[Recessed view](upper25-recessed.png) · [Extended paddles and check](upper25-extended-check.png) · [Browser geometry/contact result](upper25-browser.json) · [Upper-check results](upper-checking-playtest.json)

The user accepted this playtest on October 12, 2026. These mechanics are included in release 0.4.9 and the GitHub Pages build.

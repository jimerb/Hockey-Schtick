# Hockey Schtick Gameplay Overview

**Concept draft — September 30, 2026**

Hockey Schtick is a browser game that presents a hockey match from the pinball end of a tabletop rink. You control two flippers that defend your near goal and shoot a single puck toward the opposing net. Five opposing skaters slide and rotate on straight tracks, while their goalie protects the far goal. A save can become an attack in the same motion.

The recommended starting game is **first to seven goals**, with no points leaderboard. The puck should glide smoothly on ice; the figures should move like mechanical rod-hockey pieces, with readable starts, stops, and stick swings. The challenge comes from timing, angles, and rebounds.

Mockup four is the agreed visual baseline: centered elevated view from behind your defending end, the entire rink visible, straight black slots, blue LED boards, broad flippers, and an unobstructed foreground. A gentle slope toward your flippers is also agreed in principle. The rules and behaviors below are proposals to try in playtesting, rather than a finished specification.

## Selected visual baseline

![Selected Hockey Schtick mockup four](C:/Codex Projects/Hockey Schtick/concepts/mockup-04-selected.png)

Mockup four establishes the visual direction. Its timer is illustrative; the default match would display FIRST TO 7.

## What a rally feels like

A winger slides along its track, turns its stick, and sends the puck toward your end. You wait for the puck to enter the left flipper’s reach, then flick it up the right boards. The bank carries it past a forward. A defender rotates late and clips it toward center, where another figure sends it back.

This time you soften the incoming puck with a raised flipper, release, and fire through an opening. The goalie shifts toward the shot; the puck hits its pad and rebounds. A second well-timed return catches the goalie moving and goes in.

This rhythm—read the attack, save, choose a shot, fight for the rebound—is the game. Possession changes through contact with sticks, flippers, and boards. Play continues until a goal or a necessary stoppage.

## Winning and match flow

**First to Seven is the recommended default.** Your goals and the opponent’s goals each count as one. The first side to reach seven wins immediately; no two-goal margin is required. A lucky deflection counts, and an own goal benefits the other side. Saves and special shots earn recognition without changing the score.

Choose a difficulty and press Play. A brief countdown leads to a center puck drop. The first opponent touch should establish play with a pass or controlled push, giving you time to see the attack rather than producing an immediate point-blank shot.

After a goal, show the updated score, play a short celebration, and reset for the next center drop. Keep that break brief and use the same opening procedure for both sides. At seven, show the final result and offer Rematch or Change Difficulty.

There are no lives or separate lost-ball rules. A puck entering your goal is the opponent’s goal, followed by another rally. There are no offsides, icing calls, or regulation periods in the starting game.

The timer in mockup four is a visual placeholder. For this default mode, that display should say **FIRST TO 7** or show match progress.

## Two flippers with room for skill

The only essential actions are left flipper and right flipper. Each responds immediately when pressed and returns when released. Pressing both is allowed. Controls should work naturally with two keyboard keys, two controller buttons, or two thumb areas that leave the rink visible.

A quick press strikes the puck. Holding a flipper up can block, soften, or briefly cradle it when the angle permits; releasing and pressing again sets up a deliberate shot. Cradling should result from the shape and motion of the flipper, rather than snapping the puck into place.

Contact timing determines direction. A hit closer to the tip should produce a different angle from a hit nearer the pivot. Players learn to shoot through the middle, bank off either board, and use rebounds to change sides. There is no separate aiming cursor or charge meter.

Repeated button presses can keep a beginner involved, but waiting for the right moment should produce better shots. Holding both flippers should leave openings that make it an incomplete defense.

Keep the broad flipper coverage of mockup four. Define a clear goal line behind the central gap, with a small visible goal-mouth cue that does not obscure the puck. A goal registers when the puck fully crosses that line. Shape the outer corners to feed reachable flipper areas, avoiding side drains that bypass both flippers.

## Ice motion and the gentle slope

The puck should glide freely, retain momentum, and rebound cleanly from the boards. A powerful return should travel convincingly up the rink. Small deflections should produce believable changes of direction, rather than abrupt ownership changes or unexplained speed boosts.

Use a weak, continuous downhill pull toward your end. It gradually slows an uphill shot and brings a slow puck back toward the flippers. It should be subtle during a fast rally and apparent when the puck loses speed.

This gives unreachable space a useful role. If a puck slips outside a skater’s reach, you may have earned a safer route back to your flippers. The opposing figures should wait for a reachable intercept instead of leaving their slots to retrieve it.

Avoid a slope so strong that uphill attacks feel laborious or every rebound becomes an immediate emergency. Also avoid a slope so weak that the player waits several seconds for a nearly motionless puck. The right balance must be judged through play.

The puck should spend most of its time gliding on the ice, with a little wobble and occasional low hops after strong contact with a stick, flipper, board, or goalpost. The bounce should be brief and settle naturally back into a glide. Use a clear shadow on the ice so the player can still read its position and height.

For the starting game, keep those hops below the height needed to sail over sticks or flippers. Contact should remain consistent with what the player sees; an airborne puck should not visibly pass through an obstacle and then register a hit. High lob shots, frequent tumbling, and pucks leaving the rink are outside the initial concept.

Compare flat puck motion with restrained bouncing in playtesting. Keep the hops only if they add physical character without making saves feel unpredictable or unfair. Shots that deliberately clear a stick could be a later mechanic, with clear visual cues and separate balance testing.

A slope cannot resolve every physical wedge. If the puck genuinely becomes trapped between objects, use a brief whistle and a neutral center restart, with no goal awarded. A puck visibly drifting back into play should be allowed to continue. Frequent recovery whistles mean the geometry needs improvement.

## Five skaters without an overwhelming attack

Keep five skaters and one far-end goalie. Two skaters occupy the far half, one works the middle, and two threaten your end. These positions preserve the layered layout of mockup four and give shots several possible obstacles.

Every skater follows one straight, unbranched slot. It slides a limited distance forward and back, rotates, and swings its stick. It cannot roam sideways, swap lanes, or chase the puck across the rink. Slot lengths and stick reach define the areas it can affect.

All five can obstruct shots and react to reachable puck contact, but their deliberate attacks should be paced. Usually one figure pursues or controls the puck while one teammate prepares to receive it. The others reposition intermittently within their own lanes.

Start with short attacking sequences: a recovery followed by a shot, or one pass followed by a shot. Occasionally use a second pass. Avoid relentless rapid exchanges among all five players.

Give attacks visible preparation: a slide to collect the puck, a turn toward the target, then a stick swing. Once a figure commits, it needs a brief recovery before another deliberate strike. A fast puck may still ricochet from a stationary stick, but deliberate follow-up shots should have readable timing.

Passes can miss. A figure can arrive late, swing too early, or send the puck into a teammate’s feet. These imperfections give the player chances to counterattack and preserve the mechanical character of rod hockey.

## Far goal base bumper and puck recovery

Use the goal’s rounded rear base pipe—the part of the frame resting on the ice—as the bumper surface. A puck trying to slip around the outside back of the net should meet that curved pipe and rebound into playable ice. Mockup four already appears tight behind the goal, but the image does not establish exact puck-sized clearances.

The rebound direction should follow the incoming angle and the curve at the point of contact. Different parts of the rounded base naturally produce different outgoing angles. Do not add random steering: the variation should come from where and how the puck strikes the pipe.

Give the base pipe a lively rebound, with a modest pinball-like speed boost if needed to keep the puck moving. That boost changes the strength of the rebound, not its geometry-driven direction. Keep returns within a defendable speed range and mostly along the ice. A distinct impact sound and subtle contact light can make the bumper action clear; avoid repeated boosts while the puck remains in contact.

The bumper operates on the outside rear base of the goal. A puck that fully crosses the scoring line through the goal mouth counts immediately and is removed from live play before the base bumper can return it. A scored goal must never be bounced back out and cancelled.

Treat the space behind the net as inaccessible dead space. Close the gap between the rear base pipe and end boards, or make it too narrow for a puck to enter, so an approaching puck contacts the rounded base before becoming trapped behind it. Shape this junction to contain low hops as well, with no landing pocket or ledge. Preserve the near defending end and its clear view from mockup four.

Verify the rear clearance in the playable rink and test angled approaches along both sides of the goal. The intended result is a readable rebound away from the dead area. If pucks repeatedly wedge here, revise the pipe and board junction rather than relying on stronger kicks.

## A goalie you can beat through play

The far goalie moves across a short track spanning its goal mouth. It responds to the puck’s visible path with limited speed and a small reaction delay.

It can block and rebound shots, and use a deliberate clearing action to return a slow reachable puck to play. It should neither swallow every rebound nor hold the puck indefinitely.

Beating it should involve recognizable opportunities: banking around a skater, shooting toward the side exposed by its movement, or returning a rebound before it recovers. It should never read an upcoming button press to move before the puck is struck.

Shots should succeed because the puck passes the goalie and enters the net. Keep collision reach consistent with the visible figure and stick, so both saves and goals look earned.

## Difficulty changes behavior

Use three clearly described choices. These are starting proposals, not fixed balance settings.

| Difficulty | How the opponent plays | What the player can learn |
| --- | --- | --- |
| Easy | Longer preparation, mostly direct attacks or one pass, more missed contacts, slower goalie reactions. | Follow the puck, time a save, and return a shot. |
| Normal | Short passing sequences, occasional bank shots, moderate reaction times, recoverable mistakes. | Pick shooting lanes and use rebounds. |
| Hard | Quicker committed moves, more varied angles, better interceptions, occasional longer passing sequences. | Anticipate plays and exploit a goalie recovering from a shot. |

Keep the puck’s basic feel, slope, flipper response, and visible stick reach consistent across difficulties. Increase the challenge through decisions and execution, while preserving reaction time.

Choose difficulty before the match. Avoid silently strengthening the opponent when you lead or weakening it when you fall behind. Winning should mean you beat the opponent you selected.

## Pinball excitement expressed through hockey

The most useful pinball elements strengthen the rally:

- **Timed shots and cradles:** Turn defense into controlled offense with the same two buttons.
- **Bank shots and lively rebounds:** Make the boards useful shooting surfaces and create second chances.
- **Save streaks:** Let the LEDs build gently through consecutive saves in a rally. Keep the effect at the edge of the rink.
- **Recognized goals:** Briefly call out a bank-shot goal or a quick goal after a save. Every goal still counts as one.
- **Goal and match-point presentation:** Use a short horn, a light sweep, and restrained extra tension when either side reaches six.

The satisfying reward is an earned goal and another rally. Avoid a second points economy, multipliers, or a persistent high-score board at the start.

Keep one puck in normal matches. Multiball would make it much harder to judge fair hockey defense. The goal’s rounded rear base pipe provides one purposeful pinball-style rebound surface; boards, sticks, and goalposts provide the rest of the initial rebound variety. Leave additional large pop bumpers and surprise puck launchers for later experiments so hockey remains the main game.

A later optional Power Play challenge could briefly withdraw one opposing skater along its existing track after a defined achievement. That would be a separate experiment after ordinary matches feel good.

## A small choice of modes

Build the ordinary match first. These modes can share the same rink and controls:

| Mode | Winning condition | Purpose |
| --- | --- | --- |
| First to Seven | First side to seven goals wins. | Main game; a clear finish without clock management. |
| Timed Match | Suggested starting length of three minutes; more goals wins. A tie leads to next-goal-wins overtime. | A short session with late-match urgency. |
| Practice | No match ending; optional repeated simple attacks. | Learn flipper timing, cradling, and bank shots. |

The proposed timed clock runs during live play and pauses for goals, resets, and recovery stoppages. A goal must fully cross the line before time expires to count. Neither the opponent nor its goalie should deliberately hold the puck to run down the clock.

A leaderboard is unnecessary for all three modes. A match result is enough; a small recap such as goals and saves can be added if it is useful.

Avoid launching with tournaments, campaigns, unlocks, or numerous special rules. Repeat play can come from improving timing, trying a harder opponent, and pressing Rematch.

## Opponent intelligence and consistency

The desired opponent is bounded and readable. It notices where the puck is going, identifies a figure that can reach it, chooses a short pass or shot, and commits to the move. It respects its tracks and stick reach, and sometimes gets the timing wrong.

**Recommendation: start with ordinary game-controlled behavior.** Prepared play patterns, reaction delays, and some variation give us direct control over fairness. This is a design recommendation; its quality still needs to be demonstrated in a prototype.

Jev or another decision model could later help choose among prepared plays or give opponents different tactical tendencies. TypeSafe describes Jev as producing structured decisions from supplied context. That suggests a possible role in selecting a play, but does not establish its suitability for this game. [TypeSafe introduction](https://typesafe.ai/blog/introducing-system-one-models-and-jev).

Immediate puck contact, figure movement, and flipper response should remain under the game’s control. The player should never experience a pause while an outside service decides what happens next. Any later decision-model experiment should retain a simple fallback and earn its place by improving variety without harming responsiveness or fairness.

## Camera sound and readability

Keep the centered, elevated camera fixed throughout the rally. Show the full rink and both flippers without following the puck, rotating the board, or zooming into attacks.

Retain the bright ice, red figures, black slots, and blue LED perimeter from mockup four. Keep reflections and lighting restrained enough that the dark puck remains easy to follow. If it passes behind a figure, a subtle visible puck indicator may be needed.

Make contact sounds distinct: a dry stick click, a solid flipper knock, a board impact, and a brief goalie-pad sound. A restrained scrape or glide sound can support the sense of ice. The action should still be readable with sound muted.

During play, show the two goal totals, the winning target or clock, and Pause. Celebrations should be brief and should not hide a live puck. Pause freezes the whole match; Resume gives a short ready cue before movement continues.

## Playing in a browser

Design the game to open from a web link, load the rink, and let the player choose a difficulty and press Play. The starting concept should require no installation or account. Load the rink and essential sounds before the opening countdown so asset loading does not interrupt the first rally.

Aim for a stable 60 frames per second on the desktop and laptop devices we choose to support, with prompt flipper response during fast rallies. This is a performance target, not a result established by the mockup. Check touchscreen devices separately before promising the same experience everywhere.

Use a compact 3D rink with the fixed camera and tactile figures of mockup four. The mockup guides the appearance; the playable scene needs its own models, materials, and lighting. Keep the blue LEDs, but simplify reflections, shadows, and glow when needed to preserve smooth play. Reducing visual detail should not change puck speed, stick reach, or the timing of the game.

Puck movement and collision checks should remain consistent when the browser draws fewer frames. A strong shot must not skip through a stick or flipper because the display briefly slows down. Test responsiveness and steady motion during ordinary rallies, busy rebounds, and goal effects, rather than judging performance from an idle rink.

If the player switches tabs or the browser loses focus, pause the match. Returning should show a ready cue before play resumes, so the player does not concede an unseen goal.

## What the first playable version needs to prove

Test one playable 3D rink in a browser, one puck, two flippers, five constrained skaters, a goalie, and a first-to-seven match. Include checks that flippers respond promptly during busy rallies and that any low puck hops remain easy to read and defend.

Judge the experience through these questions:

1. Can a new player follow the puck and understand why a goal happened?
2. Can the flippers produce deliberate directions, rather than mostly random returns?
3. Does a save create a believable chance to attack?
4. Do strong shots reach the far net while slow pucks return naturally?
5. Are attacks readable, with real chances to react and recover?
6. Do the figures feel mechanical while puck motion remains smooth?
7. Are passing lanes and goalie openings varied enough to make repeated rallies interesting?
8. Does the puck keep moving without frequent recovery whistles?

The main tuning questions are slope strength, puck speed and bounce height, flipper reach and center gap, skater track lengths, attack preparation, goalie reactions, and the far-net bumper’s kick strength and return angles. Browser smoothness and visual quality also need to be checked on the intended devices. Numerical values remain open until tested.

**Recommended starting direction:** a browser game using mockup four’s rink, straight tracks, gentle downhill puck motion, restrained low hops, a compact far-net bumper, first to seven, and opponents that make short, committed plays. Establish smooth, responsive saves and shots before adding special modes.

## Reference boundary

This is an original gameplay proposal based on the discussion and mockup four. It is not a reproduction of tournament table-hockey rules. The International Table Hockey Federation rules provide a useful reference for center starts, timed matches, and sudden-death overtime; the hybrid’s first-to-seven rule and flipper defense are our own proposed choices. [ITHF game rules](https://www.ithf.info/stiga/ithf/docs/GameRules.pdf).

Browser graphics feasibility is supported by hardware-accelerated graphics available through WebGL; this establishes a rendering capability, not a performance guarantee for Hockey Schtick. [MDN browser graphics overview](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API).


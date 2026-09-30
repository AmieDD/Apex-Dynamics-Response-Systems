---
title: Project Titan Watch Prototype Kickoff
description: internal Apex call establishing the prototype build and its unresolved assumptions
author: Apex Dynamics Response Systems
ms.date: 2026-09-29
ms.topic: reference
---

## Record details

* Date: February 26, 2030
* Duration: 29 minutes
* Context: Internal Apex kickoff after approval of the prototype boundary

## Participants

* Bontle Mokgatle, business sponsor
* Bratislav Tomic, product owner
* Snezhana Bozhilova, technical lead
* Reni Borici, quality lead
* Kadijah Batlouni, service designer
* Jakub Zawadzki, prototype product lead

## Transcript

**00:00 | Bratislav:** The goal is a testable concept for the June steering review. We are
not building the operational network. I want us to leave with the story, the build
boundary, and the assumptions that must remain visible.

**00:22 | Jakub:** The proposed composition is a command-center shell with a regional map
as the anchor. Supporting panels would show active kaiju, a threat condition, incoming
signals, and response assets.

**00:39 | Kadijah:** That composition reflects what command and sponsorship asked for. It
does not represent every role equally.

**00:48 | Bontle:** Understood. For this artifact, the audience is looking from the
regional center outward.

**00:58 | Snezhana:** The prototype will run entirely from replayed scenario data. We can replay sensor
events and update the visual state. Nothing will send an operational message.

**01:10 | Reni:** Then every action needs a test oracle that distinguishes "the
simulation changed" from "a real-world action occurred." Especially dispatch.

**01:23 | Jakub:** We were thinking of buttons that decrement available assets and push
the selected kaiju back in the scenario.

**01:33 | Kadijah:** John specifically warned that a button collapses acknowledgment,
route confirmation, readiness, and authority.

**01:44 | Jakub:** Agreed. The button is a demonstration mechanic, not a proposed dispatch
workflow. We can document that.

**01:53 | Reni:** Documentation will help evaluators. It will not stop a viewer from
learning the wrong mental model during the demo.

**02:04 | Bontle:** What alternative tells the response part of the story within the
schedule?

**02:11 | Kadijah:** We could show changes in response posture without making the operator
cause them.

**02:18 | Jakub:** That is less interactive. The steering group asked to see the system do
something.

**02:27 | Bratislav:** Capture both as options. The prototype can choose one, but the
decision log should retain the tradeoff.

**02:39 | Snezhana:** On threat condition, I can derive the display from scenario state.
It will not be a validated model output.

**02:48 | Reni:** Can the demo show conflicting inputs while the condition remains
stable?

**02:55 | Snezhana:** Yes, but it complicates the scripted path.

**03:01 | Kadijah:** The complication is the research value.

**03:08 | Bontle:** And the coherent escalation is the funding value. We need one primary
run that does not depend on a facilitator explaining data quality for ten minutes.

**03:21 | Bratislav:** Primary happy-path run for the review, messy variants for user
sessions?

**03:27 | Reni:** As long as nobody uses the happy path as the only acceptance
evidence.

**03:34 | Jakub:** For the kaiju records, Amalia supplied six entries for the replay. We can
show type, class, movement, range, and current status. Selecting one can focus the map
and any response action.

**03:51 | Kadijah:** Keep in mind that the source observations do not always arrive with a
known identity. The roster is already an interpretation.

**04:02 | Snezhana:** We can preserve the raw sensor log separately even if the interface
starts from the interpreted entities.

**04:12 | Reni:** That lets us test the transformation later.

**04:19 | Bontle:** What about the shared clock and the changing signal stream? Those
would help the room feel the pace.

**04:27 | Kadijah:** They may also imply that every element is equally current.

**04:35 | Jakub:** We can give each signal its own timestamp. Broader freshness behavior
will stay unresolved.

**04:45 | Snezhana:** The map depends on network tiles. If the connection fails, the shell
should still render.

**04:55 | Reni:** Add that to the build checks. Also keyboard paths, reduced motion,
and non-color labels from Emilia's interview.

**05:08 | Jakub:** Those fit the component approach.

**05:14 | Bontle:** I hesitate to ask, but did anyone estimate Clipzilla?

**05:20 | Snezhana:** Static image, low effort. Expression changes and animation, more
effort.

**05:27 | Reni:** What requirement does it verify?

**05:30 | Bontle:** None. It is a memorable flourish, and it loses to any core scenario
work.

**05:39 | Jakub:** I will keep it below the line until the core path works.

**05:47 | Bratislav:** Let us confirm the core path: the operator sees multiple signals,
understands that a kaiju is active, locates it, assesses a regional threat posture, and
changes the demonstration response. Correct?

**06:04 | Kadijah:** Correct as a demonstration narrative. Not yet correct as a description
of how any one role should work.

**06:12 | Reni:** I will put that sentence at the top of the test plan.

**06:20 | Bontle:** Good. We need the artifact to be convincing and the team to remain
unconvinced by its polish.

## Decisions and retained uncertainty

* Build one browser-based command-center simulation around a regional map.
* Use the provided registry and generated sensor data with no live connections.
* Tell one coherent escalation story for the steering review.
* Keep messy scenarios for later workflow sessions.
* Treat threat condition, kaiju identity, and dispatch effects as provisional
  interpretations.
* Include basic accessibility behavior where feasible without claiming validation.
* Keep Clipzilla below core scenario work.
* Preserve unresolved concerns about field correction, community visibility,
  freshness, acknowledgment, authority, and degraded operation.

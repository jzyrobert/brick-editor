# A Heuristic Algorithm for Generating LEGO Building Instructions

## Proposed approach

I would use a **hierarchical assembly planner with physical constraints, a beam search over alternative build sequences, and a readability optimiser**.

The guiding principle is:

> **Analyse backwards to discover useful subassemblies; plan forwards to establish buildability; optimise the explanation alongside the sequence.**

This should accept arbitrary brick-based models, rather than only vertical stacks. However, “any build” must mean **any input can be analysed**, not that a bounded heuristic will always find instructions. The system should distinguish a successful plan, missing technical information, and an exhausted search.

*The algorithm below is a proposed synthesis, not a reconstruction of LEGO’s proprietary software.*

## 1. What to borrow from official LEGO instruction production

LEGO describes a human-led process: instruction designers use bespoke 3D software, choose individual steps, decide how many pieces to introduce, select viewing angles, and repeatedly build the physical model in different ways. Its published history identifies LDD Pro as the instruction-production tool used exclusively from 2022, but explicitly keeps the detailed current process confidential. We therefore have evidence about the workflow, not access to its internal sequencing algorithms. ([LEGO: How we design our building instructions](https://www.lego.com/en-us/service/help/more_about_us/how-we-design-our-building-instructions-kA009000001dbljCAA); [LEGO: Building instructions through time](https://www.lego.com/en-us/history/articles/d-lego-building-instructions-through-time))

The important comparison is this:

| Documented practice or research finding | Implication for the proposed algorithm |
|---|---|
| LEGO’s designers decide both step boundaries and viewing angles. ([LEGO](https://www.lego.com/en-us/service/help/more_about_us/how-we-design-our-building-instructions-kA009000001dbljCAA)) | Do not optimise assembly order independently of how it will be explained. |
| LEGO’s team repeatedly rebuilds models and exchanges feedback. ([LEGO](https://www.lego.com/en-us/service/help/more_about_us/how-we-design-our-building-instructions-kA009000001dbljCAA)) | Include forward simulation, revision, and physical build testing—not just a one-pass export. |
| LEGO deliberately favours an explanatory illustration style over photorealism. ([LEGO](https://www.lego.com/en-us/history/articles/d-lego-building-instructions-through-time)) | Optimise visible edges, distinguishable colours, placement landmarks, and new-part emphasis. |
| Agrawala and colleagues’ assembly-instruction research treats planning and presentation as interdependent problems. ([Stanford Graphics](https://graphics.stanford.edu/papers/assembly_instructions/)) | Make visibility and comprehension part of sequence scoring, with feedback from rendering to planning. |
| Physics-aware LEGO assembly research filters actions using physical constraints before accepting them. ([Research paper](https://arxiv.org/pdf/2408.10162)) | Treat buildability as a constraint, not merely a preference that a shorter sequence can outweigh. |
| BrickLink Studio says its automatic step division works best on simple, studs-up models; its documentation also suggests submodels and reverse “unbuilding.” ([BrickLink Studio Help](https://studiohelp.bricklink.com/hc/en-us/articles/7123910550039-Automatic-instructions-Divide-into-steps)) | Use layer ordering and reverse peeling as useful heuristics, but not as the entire planner. |

The resulting objective is not “produce the fewest steps.” It is:

**Produce an executable, understandable sequence with manageable handling, clear placement information, and sensible intermediate milestones.**

## 2. Define the input and output carefully

### Input: a brick assembly, not just a surface mesh

The planner should receive:

```text
Model:
    part_instances:
        unique instance ID
        part type and variant
        colour / decoration
        target position and orientation

    optional:
        intended connections
        submodel hierarchy
        articulated-joint configurations
        flexible-element routes
        author-specified ordering constraints
        separate finished objects / loose accessories

PartLibrary:
    geometry and collision representation
    connector positions, types, and axes
    permitted insertion / removal motions
    joint degrees of freedom
    permitted snap-fit compliance
    mass and approximate connection-strength data
    confidence / provenance of each property

BuilderProfile:
    experience and dexterity assumptions
    cognitive complexity budget
    available hands, workspace, and permitted tools
    whether temporary supports are allowed
    print or interactive output

SearchBudget:
    beam width
    candidate-action limit
    time / expansion limit
    permitted recovery operations
```

An ordinary surface mesh would first need to be converted into a specific brick design. That is a separate upstream task: this algorithm does not silently change the design or substitute bricks to make sequencing easier.

**Geometry alone is not enough.** Under this design, a part’s connector metadata tells the planner whether it should slide along an axle, press onto studs, rotate about a hinge, or use a validated snap operation. Missing metadata must produce uncertainty, not an invented motion.

### Output: an instruction programme

The internal result should be richer than a list of pictures:

```text
InstructionPlan:
    physical action sequence
    subassembly construction / join structure
    step boundaries
    camera and annotation choices
    parts required at each step
    explicit handling / support operations
    final-model correspondence
    validation results and unresolved assumptions
```

Keep **physical orientation** and **camera orientation** separate. Turning a camera to show the underside does not establish that the builder can safely turn the model over.

## 3. The core representation: several assemblies, not one growing pile

A planner that only tracks “parts already installed in the main model” cannot naturally build a wheel, roof, or gearbox separately.

Instead, use this state:

```text
State:
    unused_parts

    workbench_assemblies:
        disjoint sets of actual part instances
        current poses and joint configurations
        established connections and contacts
        table support / hand support / temporary fixtures

    unfinished_target_relations
    current_focus
    previous_view
    previously_explained_patterns
    action_history
    accumulated_cost
```

A *workbench assembly* can be the main model, a partly completed module, or a finished module waiting to be attached. It does not have to be a single rigid body: articulated joints remain explicit.

Two rules are particularly important.

**First, the final connection graph is not an ordering graph.** Two connected parts do not automatically imply that one must precede the other. A part might be supported from either side, or belong to a separately built module. Ordering constraints should be associated with a chosen assembly method.

**Second, submodels are hypotheses until validated.** An author’s CAD grouping might be convenient for editing but impossible to attach as one physical unit. Conversely, a useful physical subassembly might not appear anywhere in the input hierarchy.

### Proposing subassemblies

I would generate overlapping module candidates from:

```text
PROPOSE_MODULES(model, connection_graph):

    candidates = author_submodels(model)
    candidates += compact_groups_with_few_external_connections(connection_graph)
    candidates += repeated_part_and_connector_patterns(model)
    candidates += groups_around_hinges_and_changes_of_build_direction(model)

    for group in plausible_small_groups(model):
        for motion in connector_compatible_removal_motions(group):
            if reverse_geometry_test(group, motion) finds a clear path:
                candidates.add(group)
                record motion as a possible forward-join hint

    rank candidates by:
        internal cohesion
        few and simple attachment interfaces
        ease of handling
        repeated use
        improved access or visibility when built separately

    return a bounded, diverse set of candidates
```

Reverse analysis is only a source of **hints**. A removable module is not automatically straightforward to construct, grip, or reinstall.

## 4. Search for physically valid, easy-to-explain actions

### Available actions

The planner should support at least these action families:

| Action | Meaning |
|---|---|
| `START` | Begin a new assembly from an unused part in a supported workbench position. |
| `PLACE / ATTACH` | Add an unused part to an existing assembly, including deliberately loose or captive parts where appropriate. |
| `JOIN` | Connect two assemblies that have actually been built. |
| `REORIENT` | Physically turn or reposition an assembly. |
| `ACTUATE` | Move a hinge, slide an axle, or change another supported joint configuration. |
| `HOLD / RELEASE / SUPPORT` | Establish or remove explicit assistance needed during an operation. |
| `TEMPORARILY_DETACH` | Perform bounded, explicit disassembly when the permitted technique set requires it. |

Flexible-element routing and other special techniques should enter through specialised action templates. They should not be approximated as rigid translations without warning.

### Hard constraints before soft preferences

An action must first pass physical and inventory checks. Only then should it receive a desirability score.

A suitable cost function is:

$$
J(P)=
\sum_{a\in P}
\left[
c_{\text{operation}}
+w_h c_{\text{handling}}
+w_f c_{\text{fragility}}
+w_a c_{\text{ambiguity}}
+w_r c_{\text{reorientation}}
+w_s c_{\text{context-switch}}
+w_p c_{\text{part-selection}}
+w_t c_{\text{temporary-work}}
\right]
+w_{\text{pages}}N_{\text{pages}}.
$$

Here, “fragility” penalises low structural margins among otherwise acceptable actions. It does not allow a known collapsing structure to win because it saves pages.

The weights are proposed tuning parameters, not LEGO standards. They should vary with the builder profile. For example, a beginner profile could penalise difficult orientation distinctions more strongly than an expert profile.

### Main pseudocode

A beam search retains several promising partial plans rather than irrevocably choosing the best-looking next action.

```text
GENERATE_INSTRUCTIONS(model, library, profile, budget):

    target = NORMALISE_PART_INSTANCES(model)
    assessment = CHECK_TARGET_AND_METADATA(target, library)

    if assessment contains confirmed invalid input:
        return INVALID_INPUT(assessment)

    if essential action or connector metadata is missing:
        return NEEDS_METADATA(assessment)

    constraints = BUILD_TARGET_CONSTRAINTS(target, library)
    modules = PROPOSE_MODULES(target, constraints.connections)

    feedback = empty set
    diagnostics = empty collection

    for refinement_pass in budget.refinement_passes:

        candidate_plans, search_report = SEARCH_FORWARD(
            target, library, profile, budget,
            constraints, modules, feedback
        )
        diagnostics.add(search_report)
        successful_manuals = []

        for plan in candidate_plans:

            steps = GROUP_ACTIONS_INTO_STEPS(plan, profile)
            views = CHOOSE_VIEWS_AND_ANNOTATIONS(steps, profile)
            manual = LAYOUT_INSTRUCTIONS(steps, views, profile)

            audit = REPLAY_AND_AUDIT(
                plan, manual, target, library, profile
            )

            if audit passes all implemented checks:
                successful_manuals.add(manual, audit)
            else:
                feedback.add(SPECIFIC_REPAIR_CONSTRAINTS(audit))
                diagnostics.add(audit)

        if successful_manuals is not empty:
            best = lowest_total_cost(successful_manuals)

            return DRAFT_VALIDATED_WITHIN_MODEL(
                best,
                assumptions = assessment.assumptions,
                physical_build_test_required = true
            )

    return NEEDS_REVIEW(
        best_partial_plan = diagnostics.best_partial_plan,
        unresolved_operations = diagnostics.unresolved_operations,
        reason = diagnostics.failure_category
    )
```

The feedback must be specific. For instance, “this roof closes the only currently supported insertion route before the axle is installed” is useful. “Never use this roof part” is not.

```text
SEARCH_FORWARD(target, library, profile, budget,
               constraints, modules, feedback):

    beam = { INITIAL_STATE(target.inventory, profile.workspace) }
    completed = []
    best_seen = empty state-cost map
    diagnostics = empty collection

    while beam is not empty and budget remains:

        successors = []

        for state in beam:

            if TARGET_SATISFIED(state, target)
               and NO_UNRESOLVED_TEMPORARY_OPERATIONS(state):
                completed.add(state.action_history)
                continue

            actions = PROPOSE_ACTIONS(
                state, target, constraints, modules, profile
            )

            actions = PRIORITISE_AND_LIMIT(actions, budget.action_limit)

            for action in actions:

                result = CHECK_ACTION(state, action, library, profile)

                if result.status == FAIL:
                    diagnostics.record_rejection(state, action, result)
                    continue

                if result.status == UNKNOWN:
                    diagnostics.record_uncertainty(state, action, result)
                    continue

                next_state = APPLY_VALIDATED_ACTION(state, result)

                # A short look-ahead, not a proof of future completion.
                access = CHECK_FUTURE_ACCESS(
                    next_state, target, modules, profile
                )

                if access proves a forbidden dead end:
                    continue

                explanation_options = QUICK_PRESENTATION_OPTIONS(
                    state, action, next_state, profile
                )

                for explanation in best_few(explanation_options):

                    node = next_state.with_presentation(explanation)

                    node.cost = state.cost
                              + POSITIVE_ACTION_COST(action, result)
                              + EXPLANATION_COST(explanation)
                              + ACCESS_RISK_PENALTY(access)

                    key = PHYSICAL_AND_PRESENTATION_STATE_KEY(node)

                    if node is dominated by best_seen[key]:
                        continue

                    best_seen[key] = node.cost
                    node.priority = node.cost
                                  + ESTIMATE_REMAINING_WORK(node, target)

                    successors.add(node)

        beam = KEEP_DIVERSE_BEST_STATES(
            successors,
            width = budget.beam_width,
            diversity = {assembly_focus, build_orientation, module_choice}
        )

        if enough complete candidates have been collected:
            break

    return completed, diagnostics
```

The state key must include more than the installed-part set. Different joint positions, supports, workbench groupings, and orientations can make the same set of parts lead to very different possibilities.

### How to propose useful actions

To keep the search manageable, preferentially propose:

```text
PROPOSE_ACTIONS(state, target, constraints, modules, profile):

    actions = []

    for assembly in state.workbench_assemblies:

        for unused part with a target relation to assembly:
            actions += permitted placement / attachment templates

        for other assembly with a compatible target interface:
            actions += permitted assembly-join templates

        actions += reorientations that improve access or support
        actions += joint motions relevant to unfinished target relations
        actions += feasible grip / support changes

    actions += starts for promising unfinished modules

    # Broaden the search when the preferred construction route stalls.
    if actions are sparse or recent search has stalled:
        actions += alternative module starts
        actions += less-preferred insertion methods
        actions += permitted temporary-detachment operations

    return actions
```

A `JOIN` never conjures up a proposed module. Both operands must exist on the workbench, and their part-instance sets must be disjoint.

## 5. The critical component: validate the operation, not just its endpoint

This is where a general planner must go beyond checking whether the final picture looks plausible.

The physics-aware research provides a useful precedent for filtering invalid actions using geometry, inventory, operability, and structural constraints. Its formulation is not a complete treatment of arbitrary LEGO mechanisms; the broader connector, handling, and motion checks below are extensions I propose. ([Research paper](https://arxiv.org/pdf/2408.10162))

```text
CHECK_ACTION(state, action, library, profile):

    if action violates inventory or part-instance ownership:
        return FAIL("Missing or reused part")

    if no validated template exists for this connection / operation:
        return UNKNOWN("Unsupported operation")

    for execution in ENUMERATE_EXECUTIONS(action, state, profile):

        # An execution includes path, grips, support, and release order.
        if execution exceeds available hands or permitted tools:
            continue

        if execution requires an undeclared external support:
            continue

        if SWEPT_VOLUME_HAS_FORBIDDEN_INTERFERENCE(execution):
            continue

        if HAND_OR_TOOL_ACCESS_IS_BLOCKED(execution):
            continue

        if CONNECTOR_ENGAGEMENT_IS_INVALID(execution, library):
            continue

        if JOINT_LIMITS_OR_PERMITTED_COMPLIANCE_ARE_EXCEEDED(execution):
            continue

        structural_result = CHECK_LOADS_AND_STABILITY(
            before = state,
            during = execution,
            after = execution.final_state,
            include_insertion_forces = true,
            include_release_of_hands = true
        )

        if structural_result is UNKNOWN:
            record unresolved physics
            continue

        if structural_result is FAIL:
            continue

        return PASS_WITHIN_MODEL(execution, structural_result)

    if any relevant execution was unresolved:
        return UNKNOWN("Insufficient geometry / physical data")

    return FAIL("No tested execution satisfies the configured constraints")
```

Three details matter.

**Permitted connector contact is not an ordinary collision.** The collision system must recognise the local contact and compliance allowed by a particular mating template. It should not simply ignore all collisions between two mating bricks.

**Stability includes the operation itself.** A model that stands still might not withstand the force needed to press in the next part. Conversely, an operation can be valid while one hand supports the model, provided that grip is available, feasible, and explicitly accounted for.

**Future access checks must not be overaggressive.** An unbuilt part does not need to be insertable immediately. It may become insertable after another module is built or a hinge is opened. Reject a closure only when the configured action model establishes a genuine dead end; otherwise use congestion as a penalty and retain alternatives.

## 6. Turn the action trace into understandable steps

A valid motion sequence is not yet a good instruction booklet.

I would begin with one meaningful assembly operation per step, then cautiously combine operations.

### Step-grouping rules

Combine additions when they concern the same assembly and local region, are easy to distinguish, and can be clearly shown together. Do not combine them when the image would conceal an essential ordering decision.

For example, placing several independent tiles might fit one step. Installing a gear and then sealing it inside a housing needs an intermediate explanation, even when both actions are physically valid.

```text
GROUP_ACTIONS_INTO_STEPS(plan, profile):

    steps = []
    current = empty step

    for action in plan.actions:

        if action changes assembly focus
           or requires a critical support instruction
           or performs a physical reorientation
           or introduces a difficult joint motion:

            FLUSH(current, steps)
            steps.add(EXPLICIT_OPERATION_STEP(action))
            continue

        proposed = current followed by action

        if EXCEEDS_COMPLEXITY_BUDGET(proposed, profile):
            FLUSH(current, steps)
            current = SINGLE_ACTION_STEP(action)
            continue

        if proposed would appear unordered to the reader:

            # For a small group, test every permitted apparent order.
            if not ALL_APPARENT_ORDERS_ARE_VALID(proposed):
                FLUSH(current, steps)
                current = SINGLE_ACTION_STEP(action)
                continue

        if not CAN_SHOW_ALL_REQUIRED_PLACEMENT_INFORMATION(proposed):
            FLUSH(current, steps)
            current = SINGLE_ACTION_STEP(action)
            continue

        current = proposed

    FLUSH(current, steps)

    steps = ADD_SUBASSEMBLY_CALLOUTS(steps, plan.assembly_history)
    steps = COMPRESS_VERIFIED_IDENTICAL_REPETITIONS(steps)
    steps = ADD_CHECKPOINTS_BEFORE_IRREVERSIBLE_OR_HIDING_OPERATIONS(steps)

    return steps
```

“Every apparent order” is important. When four additions are shown as one unnumbered batch, readers may reasonably install them in any order. Either validate those orders or show numbered internal substeps.

As an initial implementation choice, I would cap unordered batches at four additions. That makes exhaustive permutation testing manageable. This is a proposed engineering default, not an official LEGO limit.

### Repetition and parts accounting

A repeated-module callout should require matching part types, colours, decorations, relative placements, and connection structure. A mirrored assembly must not be treated as identical merely because it looks similar.

Maintain separate accounting for:

- **New parts** taken from inventory.
- **Previously built modules** being attached.
- **Existing parts** being moved or temporarily removed.

Attaching a roof subassembly must not count all its bricks as newly required for a second time.

## 7. Choose views that explain placement, not just show the model

For each step, render a small set of candidate views and annotations. Score them using:

```text
ViewCost =
    hidden placement information
  + ambiguous position / orientation
  + loss of useful reference landmarks
  + excessive change from previous view
  + excessive scale change
  + annotation clutter
```

The critical test is **information coverage**, not “what percentage of every new brick remains visible.”

A captive gear might legitimately disappear after insertion. Its instructions should clearly show the gear, its orientation, its destination, and the insertion operation before it disappears. Requiring it to remain visible in the final-state image would reject a perfectly reasonable build.

Suitable presentation options include an assembled-state view, an exploded placement view, a close-up inset, an alternate view, and an explicit support or rotation annotation.

Choose a coherent view sequence rather than selecting each picture independently:

```text
CHOOSE_VIEWS_AND_ANNOTATIONS(steps, profile):

    for each step:
        candidates[step] = GENERATE_PRESENTATION_CANDIDATES(step)

        reject candidates that omit essential:
            part identity
            placement location
            orientation
            insertion direction
            required handling

    chosen = DYNAMIC_PROGRAMMING(
        candidates,
        local_cost = ViewCost,
        transition_cost = camera_change + scale_change + context_loss
    )

    if any step has no adequate presentation:
        request a step split, different callout, or planner revision

    return chosen
```

Pagination should happen after these decisions, with minimum readable feature sizes and intact callouts as constraints. It must not reorder physical operations to make a page look better.

## 8. Worked example: an enclosed mechanism with sideways-built panels

Consider an illustrative target containing a stable base, an internal gear and axle, side panels, and a lid. Assume the completed enclosure blocks the mechanism’s necessary insertion route.

The planner might produce:

| Stage | Selected operation | Heuristic reason |
|---|---|---|
| 1 | Build the base and bearing supports. | Establishes a stable reference assembly. |
| 2 | Install the internal gear and axle while access remains open. | Avoids trapping unfinished internal work. |
| 3 | Show an alignment or movement checkpoint. | Makes a hidden error detectable before enclosure. |
| 4 | Build a side panel separately in a convenient orientation. | Improves support, access, and visibility during its construction. |
| 5 | Reorient and join that completed panel to the base. | Handles sideways connections without imposing global height order. |
| 6 | Complete the other enclosure work and attach the lid. | Closure occurs only after internal obligations are satisfied. |

A height-sort algorithm could install an obstructing panel too soon. A connection-only algorithm could miss the blocked insertion route. A reverse-removal algorithm could find a geometric decomposition without checking whether the forward insertion can be supported.

The proposed planner explicitly addresses all three failure modes.

## 9. Validation, implementation, and the meaning of success

### Audit the exported instructions

The final audit should replay the **instruction content**, not just trust the planner’s internal trace.

It should verify that every required part instance is accounted for; previously installed parts remain where they should unless explicitly moved; subassemblies exist before their join steps; physical rotations and temporary supports are represented; and the final part identities, colours, connections, and configurations match the target within stated tolerances.

It should also expand repeated callouts before checking inventory and final-model equivalence.

For interchange, LDraw provides explicit building-step boundaries through `0 STEP`. LPub3D is an open-source instruction-editing and output tool, making it a plausible presentation backend. More complex motion, grip, and validation semantics should remain in a richer sidecar representation rather than being assumed to survive a basic model export. ([LDraw file format specification](https://www.ldraw.org/article/218.html))

### Practical starting configuration

For an initial prototype, I would try a beam width of 32, roughly 24 proposed actions per state, and a shortlist of several complete plans for presentation optimisation. Increase search breadth when a model stalls.

Those values are unbenchmarked starting points. The expensive components will be motion, access, structural, and visibility checks. Cache geometry tests separately from load-dependent structural tests, and invalidate structural results when connections, loads, or supports change.

Implement ordinary rigid stud connections first, but keep the state and action interfaces general enough to add axles, pins, hinges, and specialised flexible operations. A learned ranking model could later improve candidate ordering; it should not bypass the physical constraint checks.

### Do not confuse these outcomes

```text
DRAFT_VALIDATED_WITHIN_MODEL
    A complete instruction plan passes the implemented checks.

NEEDS_METADATA
    Required connector, motion, or physical properties are missing.

SEARCH_EXHAUSTED
    No complete plan was found within the configured search space/budget.

INVALID_INPUT
    A specific input inconsistency or prohibited condition was established.
```

“Search exhausted” is not proof that the model is unbuildable. Likewise, simulation success is not a claim of official-LEGO-level instruction quality.

The evaluation should ultimately include independent builders following the generated instructions, measuring placement errors, backtracking, requests for clarification, handling failures, and completion time. That provides an analogue to LEGO’s documented repeated-build-and-feedback workflow. ([LEGO: How we design our building instructions](https://www.lego.com/en-us/service/help/more_about_us/how-we-design-our-building-instructions-kA009000001dbljCAA))

**The essential design choice is to plan a sequence of human-executable operations—not merely an ordering of bricks.** Subassembly discovery, physical validation, and visual explanation should influence one another throughout the process. That is the most useful way to translate the publicly documented research and LEGO’s human-led workflow into a general-purpose heuristic.

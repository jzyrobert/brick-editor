# Reviewed guide contact safety

The source-bound 18940 housing and 18942 rack use localized floor and Z-cap bearing allowances. Their remaining housing core and every foreign collider continue to respond. The generated source/native packets, the 4,096 aggregate child limit, default density, friction, motor effort and source project are unchanged by these checks.

`tests/unit/play-reviewed-guide-safety.test.ts` exercises actual `PlaySession` entry, movement and disposal in both Kinematic and Dynamic modes:

- A foreign wall only 0.1 LDU thick at world X=-205 blocks a 150° pinion target. The rack's material stays on the near side of the wall. Removing that collider and explicitly retrying completes the same target. The diagnostic final coordinates were 48° / -25.1327 LDU in Kinematic and 51.6414° / -25.9500 LDU in Dynamic before removal.
- An explicitly authored test rig widens the input limits to [-90°, 180°] and slider limits to [-88, 25] LDU. A +20 LDU slider target reaches the real housing end stop beyond the ordinary +10 LDU safety margin: +10.6667 LDU in Kinematic, +11.0098 LDU in Dynamic. Both report blocked and then complete a reverse target of +8 LDU. This tests physical end geometry independently of the default coordinate limit.
- Moving the source rack by 1 LDU in either Y or Z while adjusting its local joint anchor to retain coincident rest anchors is refused in both modes with the reviewed guide-alignment message. The authored joint itself remains valid.
- In an active native session, moving the actual rack body outside the Y or Z envelope restores response for all three floor/cap collider classes. A spy on the real owned-event-queue hook observes responding native collider pairs after the displacement; this does not depend on post-step manifold snapshots.

Each check compares the source project and both complete bound packet JSON values before and after runtime operations, including refusal and disposal. Test-only authored setup is recorded before the baseline comparison. These are targeted obstruction, alignment and lifecycle proofs; they do not certify arbitrary guide geometry, arbitrary mating pairs, or a complete semantic-solid topology theorem.

Reproduce on the pinned local library without network access:

```sh
FORCE_COLOR=0 npx vitest run tests/unit/play-reviewed-guide-safety.test.ts --maxWorkers=1
npx tsc -b
```

The native forward/retry cases each simulate 1,500 fixed 60 Hz ticks and use a 60 second wall-clock test allowance. That allowance accommodates measured compound-query cost and shared VM load; target, contact and source-preservation assertions are unchanged.

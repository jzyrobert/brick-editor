# Playground crate support regression

The playground push test used the loose crate's authored base-frame origin as a height measurement. With current responding native contacts, a real push rocks that base and briefly lifts the crate. Its origin rises 4.23013866 LDU, exceeding the old origin-based 3 LDU assertion even though its lowest actual source vertex remains within that support allowance.

On the pinned playground geometry, crate 3 starts at frame [-239.9997711, -7.9975784, -139.9994612]. After the original 40 push ticks it reaches [-235.1173162, -12.2277170, -195.1569557], with source Y basis row [-0.1304751, 0.9914373, -0.0053167]. Its lowest source vertex is then at [-259.4816580, -9.5118800, -209.2638009]. A downward query against the actual static tile mesh at that X/Z returns tile Y=-7.9999995: the real support gap is 1.5118805 LDU. Across every push tick, the observed source-bottom gap ranges from -0.0939021 to +1.5427731 LDU. The initial collision point lies high on the crate at source Y=-63.6881, so a push can generate rotational motion.

After the explorer stops pushing and teleports clear, 180 fixed ticks settle the crate on the same plaza: lowest source Y=-7.9973646 versus tile Y=-8, gap=-0.0026356 LDU. Native linear velocity and angular speed are both zero, and the body sleeps. The independent original swing route also passes, reaching pivot 7.45621° after 90 ticks.

`tests/unit/template-samples.test.ts` now preserves the original 3 LDU support allowance using the actual transformed source envelope on every push tick, and limits tile penetration to 0.5 LDU. It also checks settled tile contact within 0.05 LDU, linear speed below 0.01 LDU/s and angular speed below 0.01°/s. The original push distance, Kinematic immobility and swing assertions remain. Source JSON and the derived parts inventory remain identical. The final scoped test passes in 26.40 seconds (22.62 seconds of checks); TypeScript and scoped formatting checks pass. No runtime collision, push force, geometry, authored mass, friction or template data changes accompany this test correction.

Reproduce with the pinned local library:

```sh
FORCE_COLOR=0 npx vitest run tests/unit/template-samples.test.ts -t 'playground: in dynamic Play' --maxWorkers=1
npx tsc -b
```

The measured motion is an engine regression check, not a frame-rate or phone performance claim.

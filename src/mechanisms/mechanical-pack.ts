import type { Connector } from "../catalog/connector-pack";
import type { Vec3 } from "../core/types";

type AxisFeature = {
  id: string;
  center: Vec3;
  axis: Vec3;
  span: [number, number];
};
export type MechanicalFeature = AxisFeature &
  (
    | { kind: "axle"; keyDirection: Vec3; radius: number }
    | {
        kind: "pin";
        radius: number;
        seatSpan: [number, number];
        friction: boolean;
      }
    | { kind: "round-hole"; radius: number; faceSpan: [number, number] }
    | {
        kind: "keyed-hole";
        keyDirection: Vec3;
        radius: number;
        axialGrip: boolean;
        stopRadius?: number;
      }
    | {
        kind: "spur-gear";
        teeth: number;
        moduleLdu: number;
        toothDirection: Vec3;
      }
    | { kind: "rack"; normal: Vec3; moduleLdu: number; meshPitchLdu: number }
    | {
        kind: "rack-slide" | "rack-guide";
        normal: Vec3;
        mate: string;
        minimumEngagementLdu: number;
      }
    | { kind: "finger-hinge"; fingers: 2 | 3; leafDirection: Vec3 }
  );
export type MechanicalPartProfile = {
  sourceSha256: string;
  /** Evidence and scope of the reviewed ideal simulation interface. */
  review: string;
  features: readonly MechanicalFeature[];
  /** Additional explicitly reviewed studs; does not upgrade catalogue coverage. */
  studs?: readonly Connector[];
};

/** Both source packs are pinned: changes require a new review, including subparts. */
export const MECHANICAL_PACK = Object.freeze({
  id: "reviewed-mechanics-1",
  fullManifestSha256:
    "93042f4a636a15655f350c5309bb14086ad53e9df0654b3c2d0af32bfd799ce7",
  curatedManifestSha256:
    "ced540b66ad1c897e8d5315fa04ce93bad78bdda87b69781be4ed90972b466c5",
});
const holes = (xs: number[]): MechanicalFeature[] =>
  xs.map((x, i) => ({
    id: `bore-${i}`,
    kind: "round-hole",
    center: [x, 10, 0],
    axis: [0, 0, 1],
    span: [-8, 8],
    faceSpan: [-10, 10],
    radius: 6,
  }));
const pins = (friction: boolean): MechanicalFeature[] =>
  ([-1, 1] as const).map((sign) => ({
    id: sign < 0 ? "pin-negative" : "pin-positive",
    kind: "pin",
    center: [0, 0, 0],
    axis: [1, 0, 0],
    span: sign < 0 ? [-20, -2] : [2, 20],
    seatSpan: sign < 0 ? [-20, 0] : [0, 20],
    radius: 6,
    friction,
  }));
const axle = (half: number): MechanicalFeature[] => [
  {
    id: "shaft",
    kind: "axle",
    center: [0, 0, 0],
    axis: [1, 0, 0],
    span: [-half, half],
    radius: 6,
    keyDirection: [0, 1, 0],
  },
];
const keyed = (half: number, axialGrip = false): MechanicalFeature => ({
  id: "axle-bore",
  kind: "keyed-hole",
  center: [0, 0, 0],
  axis: [0, 0, 1],
  span: [-half, half],
  radius: 6,
  keyDirection: [1, 0, 0],
  axialGrip,
  ...(axialGrip ? { stopRadius: 9 } : {}),
});
const gear = (teeth: number): MechanicalFeature => ({
  id: "teeth",
  kind: "spur-gear",
  center: [0, 0, 0],
  axis: [0, 0, 1],
  span: [-4.75, 4.75],
  teeth,
  moduleLdu: 2.5,
  toothDirection: teeth === 8 ? [0, -1, 0] : [0, 1, 0],
});
const hinge = (fingers: 2 | 3): MechanicalFeature[] => [
  {
    id: "fingers",
    kind: "finger-hinge",
    center: [30, 4, 0],
    axis: [0, 0, 1],
    span: [-10, 10],
    fingers,
    leafDirection: [-1, 0, 0],
  },
];
const hingeStuds: Connector[] = [-10, 10].map((x) => ({
  kind: "stud",
  p: [x, 0, 0],
  axis: [0, -1, 0],
}));

/** Hand-reviewed from the committed LDraw sources; no shadow/proprietary data.
 * Features describe ideal joints. They do not certify snap fit or clutch torque. */
export const MECHANICAL_PARTS: Readonly<Record<string, MechanicalPartProfile>> =
  {
    "3700.dat": {
      sourceSha256:
        "6cb6522c580754cf970dad0fae688bb78cb3253a7237038dad83965fe47cfec6",
      review:
        "peghole mouths at z=±10 and cylindrical core z=±8, y=10; round through bore.",
      features: holes([0]),
    },
    "3701.dat": {
      sourceSha256:
        "8b720a50ed946757a9e7c33f2bf9f67c956ec24da48416c87610ff0048575bcf",
      review: "Same peghole/core convention as 3700; x=-20,0,20.",
      features: holes([-20, 0, 20]),
    },
    "3702.dat": {
      sourceSha256:
        "178d615c51c97ad00bdb25b8ed56bb7dc9ecff79cec77a102df053ca57cbb03d",
      review: "Same peghole/core convention as 3700; seven holes, x=-60…60.",
      features: holes([-60, -40, -20, 0, 20, 40, 60]),
    },
    "3673.dat": {
      sourceSha256:
        "d846c8c80ecd254b61378e7a40b5b75b243be75de63b2458ac834de988c05b7b",
      review:
        "Opposed connect.dat halves along X; collar 0…2, shank 2…20, lip 18…20. Free spin, seated retention.",
      features: pins(false),
    },
    "2780.dat": {
      sourceSha256:
        "2628d30bcfa42b3a616da38b8020cbc2b1edb98b055329cfac56425cdc9a8277",
      review:
        "Opposed confric5.dat halves; same seating convention. Frictional rotation is not a rigid attachment.",
      features: pins(true),
    },
    "3705.dat": {
      sourceSha256:
        "ed90738971675e2dbd05b5a0aecaccf2da32e62b4e9085b886f084de890a853a",
      review:
        "X-axis shaft ±40 with 2.5-LDU bevels; cross arms along local Y/Z.",
      features: axle(40),
    },
    "3706.dat": {
      sourceSha256:
        "a45710ed426e853ec856c7a13339ff0e1821d67ffc792b2d931ff57dafb01443",
      review: "X-axis shaft ±60, same keyed section as 3705.",
      features: axle(60),
    },
    "3707.dat": {
      sourceSha256:
        "e7843fe0f96ce7c6c99cd79bff5ee5d5493e438bfb822f00a739f900bf3374ae",
      review: "X-axis shaft ±80, same keyed section as 3705.",
      features: axle(80),
    },
    "3713.dat": {
      sourceSha256:
        "2b813f30e7a6843cbd330035763f6ef904eafc8e7b5395c98332d07e8dfa1c43",
      review:
        "bush.dat keyed Z bore ±10; 9-LDU end flanges. Ideal seated collar grips shaft axially; no measured clutch force.",
      features: [keyed(10, true)],
    },
    "4265a.dat": {
      sourceSha256:
        "c620aa9fa2510b275b17c90a26ee0bcd0e6453fe60f53cbf57f1bdab8a1fd0ea",
      review:
        "Z bore ±5 from axlehole.dat; 9-LDU collar. Ideal seated retainer, no measured clutch force.",
      features: [keyed(5, true)],
    },
    "3647.dat": {
      sourceSha256:
        "55ee0f5be8fb99fc04c47ce7c5133e4478bf90135fb44328979e73eaa09b1469",
      review:
        "8 tooth8.dat placements, keyed Z bore ±10, tooth faces ±4.75. Nominal module 2.5 LDU (10-LDU pitch radius).",
      features: [keyed(10), gear(8)],
    },
    "3648b.dat": {
      sourceSha256:
        "1bad5cfb5cd1a9dee77ad5d0d0aa93fcdaa221419492059980430d4f16dabb98",
      review:
        "24 tooth24.dat placements in s/3648s01; keyed Z bore ±9.625 in s/3648s02. Nominal module 2.5 LDU (30-LDU pitch radius). Peripheral pin holes not reviewed here.",
      features: [keyed(9.625), gear(24)],
    },
    "18940.dat": {
      sourceSha256:
        "3c913080b5efe9412212ee2b6c9745bb9e2af386458c1dd03c008487150796f4",
      review:
        "Outrigger housing: X sliding channel, paired Y walls -13/-27 and Z cheeks ±10..20 over X -60..100. Reviewed ideal guide for the 18942 web, with at least 40 LDU engaged; external pin holes not reviewed.",
      features: [
        {
          id: "rack-channel",
          kind: "rack-guide",
          center: [20, -20, 0],
          axis: [1, 0, 0],
          span: [-80, 80],
          normal: [0, -1, 0],
          mate: "18942-web",
          minimumEngagementLdu: 40,
        },
      ],
    },
    "18942.dat": {
      sourceSha256:
        "520a0f2b01ecb61112cebba1d75d972503930b4add5bf3b8492562087745e686",
      review:
        "Outrigger rack: web X -121..139, Y -19..-9, Z ±10; toothr placements X -112..136, Y -22.5, facing -Y, 8-LDU spacing. Ideal nominal module 2.5 rolling pitch at Y -25; keyed/end holes not reviewed.",
      features: [
        {
          id: "rack-web",
          kind: "rack-slide",
          center: [9, -14, 0],
          axis: [1, 0, 0],
          span: [-130, 130],
          normal: [0, -1, 0],
          mate: "18942-web",
          minimumEngagementLdu: 40,
        },
        {
          id: "rack-teeth",
          kind: "rack",
          center: [12, -25, 0],
          axis: [1, 0, 0],
          span: [-128, 128],
          normal: [0, -1, 0],
          moduleLdu: 2.5,
          meshPitchLdu: 8,
        },
      ],
    },
    "3743.dat": {
      sourceSha256:
        "64c2c950a456757f07bebd0a5dfb9447a7402aa84c723ee117c782910c1fe889",
      review:
        "X travel, ten toothr.dat placements at 8-LDU mesh pitch, teeth face -Y. Nominal module 2.5 simulation; mesh teeth approximate its pitch.",
      features: [
        {
          id: "rack-teeth",
          kind: "rack",
          center: [0, -3.5, 0],
          axis: [1, 0, 0],
          span: [-40, 40],
          normal: [0, -1, 0],
          moduleLdu: 2.5,
          meshPitchLdu: 8,
        },
      ],
    },
    "4275b.dat": {
      sourceSha256:
        "c0231ec7f2abc9b666a34cbe1738dc0d165d162a756372c709282df6391e9643",
      review:
        "h2.dat pivot local [0,10,0] maps to [30,4,0], Z axis; three fingers. Top studs explicitly reviewed.",
      features: hinge(3),
      studs: hingeStuds,
    },
    "4276b.dat": {
      sourceSha256:
        "462b9c4347d0a121eeb28ad47b2b591b4fa714bc151168984a07931c2e76b965",
      review:
        "h1.dat pivot and complementary two fingers, same convention as 4275b.",
      features: hinge(2),
      studs: hingeStuds,
    },
  };

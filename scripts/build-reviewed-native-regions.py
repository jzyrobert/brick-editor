"""Compile reviewed part-local convex regions to exact native supporting facets.
Input is the finalized reviewed source-region manifest, not arbitrary CAD meshes.
This compiler does not certify source material/cavities or grant Play support.
"""
import argparse
import hashlib
import itertools
import json
import math
import struct
from pathlib import Path

def f32(x):
    return struct.unpack('<f', struct.pack('<f', x))[0]

def sub(a, b):
    return tuple((x - y for (x, y) in zip(a, b)))

def dot(a, b):
    return sum((x * y for (x, y) in zip(a, b)))

def cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])

def integer_points(points):
    ratios = [[v.as_integer_ratio() for v in p] for p in points]
    scale = max((d for p in ratios for (_, d) in p))
    return [tuple((n * (scale // d) for (n, d) in p)) for p in ratios]

def planar_hull(qs, ids, n):
    axis = max(range(3), key=lambda k: abs(n[k]))
    keep = [k for k in range(3) if k != axis]
    ps = sorted(((qs[i][keep[0]], qs[i][keep[1]], i) for i in ids))

    def turn(a, b, c):
        return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])

    def half(seq):
        out = []
        for p in seq:
            while len(out) > 1 and turn(out[-2], out[-1], p) <= 0:
                out.pop()
            out.append(p)
        return out
    poly = [p[2] for p in half(ps)[:-1] + half(ps[::-1])[:-1]]
    if dot(cross(sub(qs[poly[1]], qs[poly[0]]), sub(qs[poly[2]], qs[poly[0]])), n) < 0:
        poly.reverse()
    return poly

def exact_facets(points):
    qs = integer_points(points)
    normal = None
    for (a, b, c) in itertools.combinations(qs, 3):
        n = cross(sub(b, a), sub(c, a))
        if any(n):
            normal = n
            break
    if normal is None:
        axis = max(range(3), key=lambda k: max((p[k] for p in qs)) - min((p[k] for p in qs)))
        extremes = [min(range(len(qs)), key=lambda i: qs[i][axis]), max(range(len(qs)), key=lambda i: qs[i][axis])]
        return (0, [], [0]) if extremes[0] == extremes[1] else (1, [], extremes)
    if all((dot(normal, sub(q, qs[0])) == 0 for q in qs)):
        axis = max(range(3), key=lambda k: abs(normal[k]))
        normal = tuple((v * (-1 if normal[axis] < 0 else 1) for v in normal))
        poly = planar_hull(qs, range(len(qs)), normal)
        return (2, [j for i in range(1, len(poly) - 1) for j in [poly[0], poly[i], poly[i + 1]]], poly)
    found = {}
    for ids in itertools.combinations(range(len(qs)), 3):
        (a, b, c) = [qs[i] for i in ids]
        n = cross(sub(b, a), sub(c, a))
        if not any(n):
            continue
        d = dot(n, a)
        sides = [dot(n, q) - d for q in qs]
        if min(sides) < 0 < max(sides):
            continue
        if max(sides) > 0:
            n = tuple((-v for v in n))
            d = -d
        g = math.gcd(*n, d)
        key = tuple((v // g for v in n)) + (d // g,)
        found[key] = [i for (i, s) in enumerate(sides) if s == 0]
    triangles = []
    for (eq, ids) in sorted(found.items()):
        poly = planar_hull(qs, ids, eq[:3])
        triangles.extend((j for i in range(1, len(poly) - 1) for j in [poly[0], poly[i], poly[i + 1]]))
    return (3, triangles, [])

def region(i, source, tag):
    # Round shared absolute coordinates once, then use a Sterbenz-admissible
    # centre so local + position recovers every shared Float32 vertex exactly.
    native = [[f32(p[0] * 0.02), f32(-p[1] * 0.02), f32(-p[2] * 0.02)] for p in source]
    pose = []
    for axis in range(3):
        mn = min((p[axis] for p in native))
        mx = max((p[axis] for p in native))
        if mn <= 0 <= mx:
            pose.append(0.0)
            continue
        near = min(abs(mn), abs(mx))
        far = max(abs(mn), abs(mx))
        pose.append(0.0 if far > 4 * near else f32(math.copysign(min(2 * near, max(far / 2, (near + far) / 2)), mn)))
    points = []
    seen = set()
    for globalpoint in native:
        local = tuple((globalpoint[k] - pose[k] for k in range(3)))
        if any((f32(local[k]) != local[k] or local[k] + pose[k] != globalpoint[k] for k in range(3))):
            raise ValueError(('shared lattice recovery', i))
        if local not in seen:
            points.append(local)
            seen.add(local)
    (rank, triangles, extremes) = exact_facets(points)
    return {'id': i, 'rank': rank, 'position': pose, 'vertices': [v for p in points for v in p], 'triangles': triangles, 'extremes': extremes, 'planeClass': tag}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    path = Path(args.input)
    if path.stat().st_size > 16 * 1024 * 1024:
        raise ValueError('source packet input byte budget')
    raw = path.read_bytes()
    packet = json.loads(raw)
    pieces = packet['regions']
    if not 0 < len(pieces) <= 4096:
        raise ValueError('source region count')
    for p in pieces:
        if not 0 < len(p) <= 256 or any((len(q) != 3 or not all((isinstance(v, (int, float)) and math.isfinite(v) for v in q)) for q in p)):
            raise ValueError('source region coordinates')
    if sum(math.comb(len(set(tuple(q) for q in p)), 3) for p in pieces) > 2_000_000:
        raise ValueError('exact supporting-plane enumeration budget')
    classes = packet.get('planeClasses', [0] * len(pieces))
    if len(classes) != len(pieces) or any((type(v) is not int or v not in [-1, 0, 1] for v in classes)):
        raise ValueError('reviewed source plane classes')
    regions = [region(i, p, classes[i]) for (i, p) in enumerate(pieces)]
    count = sum((len(r['triangles']) // 3 if r['rank'] == 2 else 1 for r in regions))
    if count > 4096:
        raise ValueError('expanded child budget')
    out = {'version': 1, 'derivation': 'shared-native-lattice/exact-supporting-facets-v1', 'source': packet['source'], 'regionInputSha256': hashlib.sha256(raw).hexdigest(), 'regionCount': len(regions), 'childCount': count, 'regions': regions}
    Path(args.output).write_text(json.dumps(out, separators=(',', ':')) + '\n')
    print(json.dumps({'regionCount': len(regions), 'childCount': count, 'rankCounts': {str(k): sum((r['rank'] == k for r in regions)) for k in range(4)}, 'sha256': hashlib.sha256(Path(args.output).read_bytes()).hexdigest()}))
if __name__ == '__main__':
    main()

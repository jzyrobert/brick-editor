# Source mechanical-system excerpts

`source-hose.mpd` contains one unmodified authored hose subfile from Philippe Hurbain (Philo)’s [42043-1 OMR model](https://library.ldraw.org/library/omr/42043-1.mpd), under its retained CCAL 2.0 header. The test placement is original CC0. Original complete-model SHA256: `6264ccf8fd18d666b68c4538eb69ddfbd87fe5bf633ebf34395b48229e9fc369`.

This fixture verifies source-content frames, endpoint/cap ancestry and preservation of all ten fallback skin references. It does not certify hose seating, pressure behavior, collision, or support for the complete Arocs. Referenced official geometry remains in the pinned library rather than being copied here. Metadata parsing follows the public [LDCad meta format](https://www.melkert.net/LDCad/tech/meta); no proprietary shadow data is used.

`42043-pneumatic-routing.mpd` is an attributed CCAL2.0 routing excerpt of the
same model: all28 unmodified authored hose subfiles and25 port-bearing hardware
placements, with their original embedded definitions. World placements are
flattened from the source hierarchy and retain original colours. It contains
every original hose fallback leaf. Chassis attachments and moving cylinder rods
are outside its scope. See [the routing review](../../../docs/reviews/AROCS-PNEUMATIC-ROUTING.md)
for source hashes, explicit flexible-end sealing assumptions and the remaining
native admission work.

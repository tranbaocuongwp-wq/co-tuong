//! Zobrist hashing.
//!
//! Keys are generated at compile time from a fixed seed with SplitMix64, so the
//! engine needs no RNG dependency and hashes stay identical across the native
//! and WebAssembly builds — which matters because both must agree on a position
//! when we cross-check them.

use crate::types::BOARD_LEN;

const SEED: u64 = 0x00C0_FFEE_1234_5678;

/// One SplitMix64 step: returns `(value, next_state)`.
const fn splitmix64(state: u64) -> (u64, u64) {
    let next = state.wrapping_add(0x9E37_79B9_7F4A_7C15);
    let mut z = next;
    z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
    z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
    (z ^ (z >> 31), next)
}

const fn build_pieces() -> [[u64; BOARD_LEN]; 16] {
    let mut table = [[0u64; BOARD_LEN]; 16];
    let mut state = SEED;
    let mut pc = 0;
    while pc < 16 {
        let mut s = 0;
        while s < BOARD_LEN {
            let (v, next) = splitmix64(state);
            state = next;
            table[pc][s] = v;
            s += 1;
        }
        pc += 1;
    }
    table
}

const fn build_side() -> u64 {
    // Continue the same stream past the piece table so the side key is
    // independent of every piece-square key.
    let mut state = SEED;
    let mut i = 0;
    while i < 16 * BOARD_LEN {
        let (_, next) = splitmix64(state);
        state = next;
        i += 1;
    }
    let (v, _) = splitmix64(state);
    v
}

/// `PIECE_KEYS[piece byte][square]`.
pub static PIECE_KEYS: [[u64; BOARD_LEN]; 16] = build_pieces();

/// XORed into the key whenever Black is to move.
pub static SIDE_KEY: u64 = build_side();

#[inline(always)]
pub fn piece_key(pc: u8, s: usize) -> u64 {
    PIECE_KEYS[pc as usize][s]
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::*;
    use std::collections::HashSet;

    #[test]
    fn keys_are_distinct_for_real_pieces() {
        // Only the 14 real piece bytes (7 kinds x 2 sides) on the 90 playable
        // squares ever get hashed; collisions there would silently corrupt the
        // transposition table, so assert they are all distinct.
        let mut seen = HashSet::new();
        for side in [RED, BLACK] {
            for kind in KING..=PAWN {
                let pc = make_piece(side, kind);
                for s in all_squares() {
                    assert!(seen.insert(piece_key(pc, s)), "duplicate zobrist key");
                }
            }
        }
        assert_eq!(seen.len(), 14 * 90);
        assert!(seen.insert(SIDE_KEY), "side key collides with a piece key");
        assert_ne!(SIDE_KEY, 0);
    }
}

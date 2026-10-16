/**
 * Ước tính XP hiển thị cho chế độ chơi. Phải KHỚP công thức thưởng thật của BE (GAME-R1):
 * floor(số câu đúng × XP mỗi câu × hệ số chế độ). Con số chính thức vẫn do BE chốt khi nộp;
 * đây chỉ là ước tính động viên theo số câu đúng, CHƯA gồm XP hoàn thành phiên.
 */
const XP_PER_CORRECT = 10;
const GAME_XP_MULTIPLIER = 1.5; // gamification.xp.mode_multipliers.game

/** +20 XP hoàn thành phiên — chỉ cộng khi nộp, KHÔNG nằm trong ước tính theo câu đúng. */
export const SESSION_COMPLETED_XP = 20;

/** Ước tính XP theo số câu đúng (chưa gồm {@link SESSION_COMPLETED_XP} hoàn thành phiên). */
export function estimateXp(correctCount: number): number {
  return Math.floor(correctCount * XP_PER_CORRECT * GAME_XP_MULTIPLIER);
}

// controllers/gameHistoryController.js
import GameHistory from '../models/Gamehistory.js';

// GET /api/game/history
export const getGameHistory = async (req, res) => {
  try {
    const userId = req.userId;

    const games = await GameHistory.find({ 'players.userId': userId })
      .sort({ playedAt: -1 })
      .limit(20)
      .lean();

    // For each game, compute the average rating this user received
    const enriched = games.map(game => {
      const ratingsForMe = game.ratings.filter(
        r => r.ratedUserId?.toString() === userId
      );

      // Group ratings by question
      const byQuestion = {};
      for (const r of ratingsForMe) {
        const key = r.questionNumber;
        if (!byQuestion[key]) {
          byQuestion[key] = { questionNumber: key, question: r.question, stars: [], avg: 0 };
        }
        byQuestion[key].stars.push(r.stars);
      }
      for (const q of Object.values(byQuestion)) {
        q.avg = parseFloat((q.stars.reduce((a, b) => a + b, 0) / q.stars.length).toFixed(1));
      }

      const overallAvg = ratingsForMe.length
        ? parseFloat((ratingsForMe.reduce((s, r) => s + r.stars, 0) / ratingsForMe.length).toFixed(1))
        : null;

      return {
        _id: game._id,
        gameId: game.gameId,
        topic: game.topic,
        totalQuestions: game.totalQuestions,
        players: game.players,
        questions: game.questions,
        ratingsReceived: Object.values(byQuestion),
        overallAvg,
        playedAt: game.playedAt,
      };
    });

    return res.json({ success: true, games: enriched });
  } catch (err) {
    console.error('getGameHistory error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};
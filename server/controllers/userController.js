import User from '../models/Users.js';

export const searchUsers = async (req, res) => {
  try {
    const { query } = req.query;
    const currentUserId = req.userId;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Search query required',
      });
    }
    
    // Search by username (case insensitive)
    const users = await User.find({
      username: { $regex: query, $options: 'i' },
      _id: { $ne: currentUserId }  // Exclude current user
    })
    .select('_id username level profilePic class')
    .limit(10);
    
    res.json({
      success: true,
      users,
    });
    
  } catch (err) {
    console.error('Search error:', err); 
    res.status(500).json({
      success: false,
      message: 'Search failed',
    });
  }
};
import jwt from 'jsonwebtoken';
import Users from '../models/Users.js';
import User from '../models/Users.js';

const protect = async (req,res,next) => {
    try{
        let token;

        //cookie
        if(req.cookies?.token){
            token = req.cookies.token;
        }
        //if not worked then use authorization
        else if(req.headers.authorization?.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }
        if(!token){
            return res.status(401).json({
                success: true,
                message: 'Please Log-in'
            });
        }
        // verify token
        const decoded = jwt.verify(token, protectrocess.env.JWT_SECRET);

        //checking if user still exists
        const user = await User.findById(decoded.userId).select('-password');
        if(!user){
            return res.status(401).json({
                success: false,
                message: 'User no longer exists'
            });
        }
        req.userId = user._id.toString();
        req.user = user;

        next();
        
        } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired. Please log in again.' });
    }
    console.error('Auth middleware error:', err);
    return res.status(500).json({ success: false, message: 'Server error in auth' });
  }
};

export default protect;
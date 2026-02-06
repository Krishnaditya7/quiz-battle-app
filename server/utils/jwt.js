import jwt from 'jsonwebtoken';

export const generateToken = (userID) => {
    return jwt.sign(
        {id: userID},
        process.env.JWT_SECRET,
        {expiresIn: '30d'}
    );
};
export const verifyToken = (token) => {
    try{
        return jwt.verify(token, process.env.JWT_SECRET);
    }
    catch(error){
        return null;
    }; 
};
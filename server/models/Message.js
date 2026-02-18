import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
    sender:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    team : {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Team',
        required: true,
        index: true
    },
    type:{
        type: String,
        enum: ['text','image','video','voice','document','pdf','location','system'],
        required:true
    },
    content: {
        type: String,
        trim: true,
        maxlength: 4000
    },
    //Media files
    fileURL: String,
    fileName: String,
    mimeType: String,
    fileSize: Number,
    Duration: Number,

    thumbnailURL: String,

    // metadata
    isRead:{ type:Boolean, default:false},
    readBy:[{
        user: {type: mongoose.Schema.Types.ObjectId, ref:'User'},
        at: {type: Date, default: Date.now}
    }],
    createdAt:{
        type: Date,
        default: Date.now,
        index: true
    }
});
const Msg = mongoose.model('Msg',messageSchema);
export default Msg;
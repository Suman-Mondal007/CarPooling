import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    trip: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trip',
      required: true,
      index: true
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true
    },
    content: {
      type: String,
      required: [true, 'Message content is required'],
      trim: true,
      maxlength: 1000
    },
    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ]
  },
  {
    timestamps: true
  }
);

// Index for fetching messages by trip, ordered by creation time
messageSchema.index({ trip: 1, createdAt: 1 });

export const Message = mongoose.model('Message', messageSchema);
export default Message;

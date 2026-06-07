import mongoose from 'mongoose';

const barberSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    specialties: {
      type: String,
    },
    isAccepting: {
      type: Boolean,
      required: true,
      default: true,
    },
    isPaused: {
      type: Boolean,
      required: true,
      default: false,
    },
    maxQueueSize: {
      type: Number,
      required: true,
      default: 10,
    },
    avgServiceTime: {
      type: Number,
      required: true,
      default: 20,
    },
    totalServed: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

const Barber = mongoose.model('Barber', barberSchema);
export default Barber;

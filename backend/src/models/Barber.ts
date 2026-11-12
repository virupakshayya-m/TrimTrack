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
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: any) => {
        ret.id = ret._id;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: (_doc, ret: any) => {
        ret.id = ret._id;
        return ret;
      },
    },
  }
);

const Barber = mongoose.model('Barber', barberSchema);
export default Barber;

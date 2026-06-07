import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    guestName: {
      type: String,
      required: false,
    },
    barberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Barber',
      required: true,
    },
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
    },
    status: {
      type: String,
      required: true,
      enum: ['pending', 'active', 'serving', 'completed', 'no-show', 'cancelled', 'waitlisted'],
      default: 'pending',
    },
    bookingType: {
      type: String,
      required: true,
      default: 'walkin',
    },
    priority: {
      type: Number,
      required: true,
      default: 0,
    },
    position: {
      type: Number,
      required: true,
      default: 0,
    },
    estimatedWaitMinutes: {
      type: Number,
      required: true,
      default: 0,
    },
    scheduledAt: {
      type: Date,
    },
    servedAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
    cancelledAt: {
      type: Date,
    },
    penaltyApplied: {
      type: Boolean,
      required: true,
      default: false,
    },
    wasTransferred: {
      type: Boolean,
      required: true,
      default: false,
    },
    transferNote: {
      type: String,
    },
    notes: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const Booking = mongoose.model('Booking', bookingSchema);
export default Booking;

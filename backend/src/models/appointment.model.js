import mongoose from 'mongoose';

const appointmentSchema = new mongoose.Schema(
  {
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true,
    },
    userId: {
      type: String,
      required: true,
    },
    userName: {
      type: String,
      required: true,
    },
    userEmail: {
      type: String,
      required: true,
    },
    userPhone: {
      type: String,
      required: true,
    },
    hospitalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hospital',
      required: true,
    },
    appointmentDate: {
      type: Date,
      required: true,
    },
    duration: {
      type: Number,
      enum: [30, 45, 60],
      required: true,
      description: 'Duration in minutes (30, 45, or 60)',
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'cancelled', 'completed'],
      default: 'pending',
    },
    notes: {
      type: String,
      default: '',
    },
    adminNotes: {
      type: String,
      default: '',
    },
    // Payment fields
    consultationFee: {
      type: Number,
      default: 0,
      description: 'Total consultation fee from doctor',
    },
    paymentAmount: {
      type: Number,
      default: 0,
      description: 'Amount paid (50% of consultation fee)',
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'half_paid', 'paid', 'failed', 'refunded'],
      default: 'pending',
    },
    stripeSessionId: {
      type: String,
      default: '',
    },
    stripePaymentIntentId: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

export default mongoose.model('Appointment', appointmentSchema);

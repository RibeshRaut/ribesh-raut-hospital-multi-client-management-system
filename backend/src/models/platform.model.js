import { Schema, model } from "mongoose";

const platformSettingsSchema = new Schema(
  {
    maintenanceMode: {
      type: Boolean,
      default: false,
    },
    allowNewRegistrations: {
      type: Boolean,
      default: true,
    },
    requireEmailVerification: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

const PlatformSettings = model("PlatformSettings", platformSettingsSchema);

export default PlatformSettings;

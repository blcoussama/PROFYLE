import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

export enum UserRole {
  CANDIDATE = 'candidate',
  RECRUITER = 'recruiter',
}

@Schema({ _id: false })
export class Experience {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ required: true, trim: true })
  company: string;

  @Prop({ type: String, default: null, trim: true })
  location: string | null;

  @Prop({ required: true })
  startDate: Date;

  @Prop({ type: Date, default: null })
  endDate: Date | null;

  @Prop({ default: false })
  current: boolean;

  @Prop({ type: String, default: null, trim: true })
  description: string | null;
}

@Schema({ _id: false })
export class Education {
  @Prop({ required: true, trim: true })
  school: string;

  @Prop({ required: true, trim: true })
  degree: string;

  @Prop({ type: String, default: null, trim: true })
  field: string | null;

  @Prop({ required: true })
  startDate: Date;

  @Prop({ type: Date, default: null })
  endDate: Date | null;

  @Prop({ default: false })
  current: boolean;
}

@Schema({ timestamps: true })
export class User {
  // ─── Auth fields ────────────────────────────────────────────────────────────

  @Prop({ required: true, trim: true })
  firstName: string;

  @Prop({ required: true, trim: true })
  lastName: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({ type: String, enum: UserRole, required: true })
  role: UserRole;

  @Prop({ default: false })
  isEmailVerified: boolean;

  @Prop({ type: String, default: null })
  emailVerificationToken: string | null;

  @Prop({ type: Date, default: null })
  emailVerificationExpiry: Date | null;

  @Prop({ type: String, default: null })
  passwordResetToken: string | null;

  @Prop({ type: Date, default: null })
  passwordResetExpiry: Date | null;

  @Prop({ type: String, default: null })
  refreshToken: string | null;

  // ─── Profile fields (common) ─────────────────────────────────────────────

  @Prop({ type: String, default: null })
  avatarUrl: string | null;

  @Prop({ type: String, default: null, trim: true })
  headline: string | null;

  @Prop({ type: String, default: null, trim: true })
  bio: string | null;

  @Prop({ type: String, default: null, trim: true })
  location: string | null;

  @Prop({ type: String, default: null, trim: true })
  phone: string | null;

  @Prop({ type: String, default: null, trim: true })
  linkedinUrl: string | null;

  // ─── Candidate-only fields ───────────────────────────────────────────────

  @Prop({ type: [String], default: [] })
  skills: string[];

  @Prop({ type: String, default: null })
  githubUrl: string | null;

  @Prop({ type: String, default: null })
  portfolioUrl: string | null;

  @Prop({ type: String, default: null })
  cvKey: string | null;

  @Prop({ type: Boolean, default: false })
  isAvailable: boolean;

  @Prop({ type: [Object], default: [] })
  experiences: Experience[];

  @Prop({ type: [Object], default: [] })
  education: Education[];

  // ─── Recruiter-only fields ───────────────────────────────────────────────

  @Prop({ type: String, default: null, trim: true })
  companyName: string | null;

  @Prop({ type: String, default: null, trim: true })
  companyWebsite: string | null;
}

export const UserSchema = SchemaFactory.createForClass(User);

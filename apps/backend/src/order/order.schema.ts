import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

export type OrderDocument = Order & Document

@Schema()
export class Order {
  @Prop({ required: true })
  customerEmail: string

  @Prop({ required: true, unique: true })
  downloadToken: string

  @Prop({ required: true })
  tokenExpiry: Date

  @Prop({ type: [String], required: true })
  directoryPaths: string[]

  @Prop({ default: Date.now })
  createdAt: Date
}

export const OrderSchema = SchemaFactory.createForClass(Order)

import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { Order, OrderDocument } from './order.schema'

interface OrderInput {
  customerEmail: string
  downloadToken: string
  tokenExpiry: Date
  directoryPaths: string[]
}

@Injectable()
export class OrderService {
  constructor(@InjectModel(Order.name) private orderModel: Model<OrderDocument>) {}

  async createOrder(orderInput: OrderInput): Promise<Order> {
    const createdOrder = new this.orderModel(orderInput)
    return createdOrder.save()
  }

  async findByToken(token: string): Promise<Order | null> {
    return this.orderModel.findOne({ downloadToken: token }).exec()
  }

  async findById(id: string): Promise<Order | null> {
    return this.orderModel.findById(id).exec()
  }

  async findRecentOrders(limit: number = 20): Promise<Order[]> {
    return this.orderModel
      .find()
      .sort({ createdAt: -1 }) // Sort by creation date, newest first
      .limit(limit)
      .exec()
  }
}

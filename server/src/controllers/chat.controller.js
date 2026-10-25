import Message from '../models/Message.js';
import Trip from '../models/Trip.js';
import Booking from '../models/Booking.js';
import { validateChatAccess } from '../sockets/chat.socket.js';

export async function getConversations(req, res, next) {
  try {
    if (req.user.role === 'COMPANY_ADMIN') {
      return res.status(403).json({
        success: false,
        data: null,
        error: {
          code: 'FORBIDDEN_ADMIN',
          message: 'Company admins are not permitted to access chat conversations',
          details: null
        }
      });
    }

    // Find rides where user has confirmed booking
    const myBookings = await Booking.find({
      passenger: req.user._id,
      organization: req.organization._id,
      status: 'CONFIRMED'
    }).select('ride');
    const bookedRideIds = myBookings.map((b) => b.ride);

    // Find trips where user is driver or confirmed passenger
    const trips = await Trip.find({
      organization: req.organization._id,
      $or: [
        { driver: req.user._id },
        { ride: { $in: bookedRideIds } }
      ]
    })
      .populate({
        path: 'ride',
        populate: [
          { path: 'driver', select: 'name phone' },
          { path: 'vehicle', select: 'model registrationNumber' }
        ]
      })
      .sort({ updatedAt: -1 });

    const conversations = await Promise.all(
      trips.map(async (trip) => {
        const lastMessage = await Message.findOne({ trip: trip._id })
          .sort({ createdAt: -1 })
          .populate('sender', 'name');

        const unreadCount = await Message.countDocuments({
          trip: trip._id,
          readBy: { $ne: req.user._id },
          sender: { $ne: req.user._id }
        });

        let isReadOnly = false;
        if (trip.status === 'COMPLETED' && trip.completedAt) {
          const hours = (Date.now() - new Date(trip.completedAt).getTime()) / (1000 * 60 * 60);
          if (hours > 24) isReadOnly = true;
        } else if (trip.status === 'CANCELLED') {
          isReadOnly = true;
        }

        const isDriver = trip.driver.toString() === req.user._id.toString();

        return {
          tripId: trip._id,
          tripStatus: trip.status,
          isDriver,
          isReadOnly,
          unreadCount,
          lastMessage: lastMessage
            ? {
                _id: lastMessage._id,
                content: lastMessage.content,
                createdAt: lastMessage.createdAt,
                sender: {
                  _id: lastMessage.sender?._id,
                  name: lastMessage.sender?.name
                }
              }
            : null,
          ride: trip.ride
            ? {
                _id: trip.ride._id,
                departureAt: trip.ride.departureAt,
                originAddress: trip.ride.origin?.address,
                destinationAddress: trip.ride.destination?.address,
                driver: trip.ride.driver,
                vehicle: trip.ride.vehicle
              }
            : null
        };
      })
    );

    // Sort by last message date, fallback to trip update time
    conversations.sort((a, b) => {
      const timeA = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0;
      const timeB = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0;
      return timeB - timeA;
    });

    res.status(200).json({
      success: true,
      data: {
        items: conversations,
        total: conversations.length
      },
      error: null
    });
  } catch (error) {
    next(error);
  }
}

export async function getTripMessages(req, res, next) {
  try {
    const { id: tripId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 50;
    const skip = (pageNum - 1) * limitNum;

    const { trip, isReadOnly } = await validateChatAccess(
      tripId,
      req.user,
      req.organization._id
    );

    const [messages, total] = await Promise.all([
      Message.find({ trip: trip._id })
        .sort({ createdAt: 1 }) // Newest last (chronological for reading)
        .skip(skip)
        .limit(limitNum)
        .populate('sender', 'name role'),
      Message.countDocuments({ trip: trip._id })
    ]);

    // Mark messages as read by current user in background
    Message.updateMany(
      { trip: trip._id, readBy: { $ne: req.user._id } },
      { $addToSet: { readBy: req.user._id } }
    ).catch(() => {});

    res.status(200).json({
      success: true,
      data: {
        items: messages.map((m) => ({
          _id: m._id,
          trip: m.trip,
          sender: {
            _id: m.sender?._id,
            name: m.sender?.name,
            role: m.sender?.role
          },
          content: m.content,
          createdAt: m.createdAt,
          readBy: m.readBy
        })),
        total,
        page: pageNum,
        limit: limitNum,
        isReadOnly
      },
      error: null
    });
  } catch (error) {
    if (error.code === 'FORBIDDEN_ADMIN' || error.code === 'NOT_A_PARTICIPANT') {
      return res.status(403).json({
        success: false,
        data: null,
        error: {
          code: error.code,
          message: error.message,
          details: null
        }
      });
    }
    if (error.code === 'TRIP_NOT_FOUND') {
      return res.status(404).json({
        success: false,
        data: null,
        error: {
          code: error.code,
          message: error.message,
          details: null
        }
      });
    }
    next(error);
  }
}

export default {
  getConversations,
  getTripMessages
};

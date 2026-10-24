import Notification from '../models/Notification.js';

export async function getNotifications(req, res, next) {
  try {
    const { page = 1, limit = 20, unreadOnly } = req.query;
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    const query = {
      user: req.user._id,
      organization: req.organization._id
    };

    if (unreadOnly === 'true' || unreadOnly === true) {
      query.isRead = false;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Notification.countDocuments(query),
      Notification.countDocuments({
        user: req.user._id,
        organization: req.organization._id,
        isRead: false
      })
    ]);

    res.status(200).json({
      success: true,
      data: {
        items: notifications,
        total,
        unreadCount,
        page: pageNum,
        limit: limitNum
      },
      error: null
    });
  } catch (error) {
    next(error);
  }
}

export async function markNotificationAsRead(req, res, next) {
  try {
    const notification = await Notification.findOneAndUpdate(
      {
        _id: req.params.id,
        user: req.user._id,
        organization: req.organization._id
      },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        data: null,
        error: {
          code: 'NOTIFICATION_NOT_FOUND',
          message: 'Notification not found',
          details: null
        }
      });
    }

    res.status(200).json({
      success: true,
      data: notification,
      error: null
    });
  } catch (error) {
    next(error);
  }
}

export async function markAllNotificationsAsRead(req, res, next) {
  try {
    const result = await Notification.updateMany(
      {
        user: req.user._id,
        organization: req.organization._id,
        isRead: false
      },
      { isRead: true }
    );

    res.status(200).json({
      success: true,
      data: {
        message: 'All notifications marked as read',
        modifiedCount: result.modifiedCount
      },
      error: null
    });
  } catch (error) {
    next(error);
  }
}

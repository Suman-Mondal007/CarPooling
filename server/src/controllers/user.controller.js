import User from '../models/User.js';

export const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).populate('organization');
    return res.status(200).json({
      success: true,
      data: { user },
      error: null
    });
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (req, res, next) => {
  try {
    const { name, phone, licenceNumber, licenceExpiry } = req.body;
    const updates = {};

    if (name !== undefined) updates.name = name;
    if (phone !== undefined) updates.phone = phone;
    if (licenceNumber !== undefined) updates.licenceNumber = licenceNumber;
    if (licenceExpiry !== undefined) updates.licenceExpiry = licenceExpiry;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true }
    ).populate('organization');

    return res.status(200).json({
      success: true,
      data: { user },
      error: null
    });
  } catch (error) {
    next(error);
  }
};

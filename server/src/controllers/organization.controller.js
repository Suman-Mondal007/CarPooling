import Organization from '../models/Organization.js';

export const getMyOrganization = async (req, res, next) => {
  try {
    const org = await Organization.findById(req.organizationId);
    if (!org) {
      return res.status(404).json({
        success: false,
        data: null,
        error: {
          code: 'ORGANIZATION_NOT_FOUND',
          message: 'Organization not found',
          details: null
        }
      });
    }

    return res.status(200).json({
      success: true,
      data: { organization: org },
      error: null
    });
  } catch (error) {
    next(error);
  }
};

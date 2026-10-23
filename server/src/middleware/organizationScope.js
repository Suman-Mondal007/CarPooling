export const organizationScope = (req, res, next) => {
  if (!req.user || !req.user.organization) {
    return res.status(401).json({
      success: false,
      data: null,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Organization membership required',
        details: null
      }
    });
  }

  const orgId = req.user.organization._id || req.user.organization;
  req.organization = req.user.organization;
  req.organizationId = orgId;
  req.orgFilter = { organization: orgId };

  next();
};

export default organizationScope;

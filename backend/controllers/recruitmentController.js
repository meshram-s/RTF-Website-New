// controllers/recruitmentController.js
const { getUserById, updateUser } = require('../models/userModel');
const { generateOfficialRtfId } = require('../services/rtfIdService');

/**
 * APPROVE APPLICANT CONTROLLER
 * Path: PATCH /api/recruitment/approve/:uid
 */
const approveApplicant = async (req, res) => {
  try {
    const { uid } = req.params;

    // 1. Fetch user by UID
    const user = await getUserById(uid);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Applicant not found.',
      });
    }

    if (user.status === 'active') {
      return res.status(400).json({
        success: false,
        error: 'Applicant is already approved.',
      });
    }

    // 2. Generate permanent/official RTF ID (e.g., SD2701@RTF)
    const officialRtfId = await generateOfficialRtfId(user.domain, user.yearOfPassing);

    // 3. Update status & RTF ID
    await updateUser(uid, {
      rtfId: officialRtfId,       // Overwrites temp ID with official ID
      tempRtfId: user.rtfId,      // Backs up temporary ID
      status: 'active',
      approvedBy: req.user?.uid || 'admin',
      approvedAt: Date.now(),
    });

    return res.status(200).json({
      success: true,
      message: 'Applicant approved successfully.',
      data: {
        uid,
        officialRtfId,
        status: 'active',
      },
    });
  } catch (error) {
    console.error('Error in approveApplicant controller:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal Server Error',
    });
  }
};

module.exports = {
  approveApplicant,
};
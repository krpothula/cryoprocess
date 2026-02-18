/**
 * Usage Controller
 *
 * Provides compute usage reports for admin billing/reporting.
 * Aggregates job data by user, project, and month.
 */

const Job = require('../models/Job');
const User = require('../models/User');
const Project = require('../models/Project');
const logger = require('../utils/logger');
const response = require('../utils/responseHelper');

/**
 * GET /api/admin/usage
 * Query params:
 *   - startDate (ISO string, default: 30 days ago)
 *   - endDate (ISO string, default: now)
 *   - groupBy (user | project | month, default: user)
 *   - format (json | csv, default: json)
 */
exports.getUsageReport = async (req, res) => {
  try {
    const {
      startDate: startDateParam,
      endDate: endDateParam,
      groupBy = 'user',
      format = 'json',
    } = req.query;

    const startDate = startDateParam ? new Date(startDateParam) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = endDateParam ? new Date(endDateParam) : new Date();

    // Base match: terminal jobs within date range that have timing data
    const matchStage = {
      $match: {
        status: { $in: ['success', 'failed'] },
        start_time: { $gte: startDate },
        end_time: { $lte: endDate },
      },
    };

    // Compute duration in seconds
    const addDuration = {
      $addFields: {
        duration_seconds: {
          $divide: [{ $subtract: ['$end_time', '$start_time'] }, 1000],
        },
      },
    };

    let groupStage;
    let sortStage;

    switch (groupBy) {
      case 'project':
        groupStage = {
          $group: {
            _id: '$project_id',
            total_jobs: { $sum: 1 },
            successful_jobs: { $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] } },
            failed_jobs: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
            total_seconds: { $sum: '$duration_seconds' },
          },
        };
        sortStage = { $sort: { total_seconds: -1 } };
        break;

      case 'month':
        groupStage = {
          $group: {
            _id: {
              year: { $year: '$start_time' },
              month: { $month: '$start_time' },
            },
            total_jobs: { $sum: 1 },
            successful_jobs: { $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] } },
            failed_jobs: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
            total_seconds: { $sum: '$duration_seconds' },
          },
        };
        sortStage = { $sort: { '_id.year': 1, '_id.month': 1 } };
        break;

      default: // 'user'
        groupStage = {
          $group: {
            _id: '$user_id',
            total_jobs: { $sum: 1 },
            successful_jobs: { $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] } },
            failed_jobs: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
            total_seconds: { $sum: '$duration_seconds' },
          },
        };
        sortStage = { $sort: { total_seconds: -1 } };
        break;
    }

    const pipeline = [matchStage, addDuration, groupStage, sortStage];
    const results = await Job.aggregate(pipeline);

    // Enrich results with names
    const enriched = await Promise.all(
      results.map(async (row) => {
        const entry = {
          totalJobs: row.total_jobs,
          successfulJobs: row.successful_jobs,
          failedJobs: row.failed_jobs,
          totalHours: Math.round((row.total_seconds / 3600) * 100) / 100,
        };

        if (groupBy === 'user') {
          const user = await User.findOne({ id: row._id }).select('username email first_name last_name').lean();
          entry.userId = row._id;
          entry.username = user?.username || 'Unknown';
          entry.name = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username : 'Unknown';
        } else if (groupBy === 'project') {
          const project = await Project.findOne({ id: row._id }).select('project_name').lean();
          entry.projectId = row._id;
          entry.projectName = project?.project_name || 'Deleted Project';
        } else {
          entry.year = row._id.year;
          entry.month = row._id.month;
          entry.label = `${row._id.year}-${String(row._id.month).padStart(2, '0')}`;
        }

        return entry;
      })
    );

    // CSV export
    if (format === 'csv') {
      if (enriched.length === 0) {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="usage.csv"');
        return res.send('No data');
      }

      const headers = Object.keys(enriched[0]);
      const csvRows = [
        headers.join(','),
        ...enriched.map(row => headers.map(h => JSON.stringify(row[h] ?? '')).join(',')),
      ];

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="usage.csv"');
      return res.send(csvRows.join('\n'));
    }

    // Compute totals
    const totals = enriched.reduce(
      (acc, row) => ({
        totalJobs: acc.totalJobs + row.totalJobs,
        successfulJobs: acc.successfulJobs + row.successfulJobs,
        failedJobs: acc.failedJobs + row.failedJobs,
        totalHours: Math.round((acc.totalHours + row.totalHours) * 100) / 100,
      }),
      { totalJobs: 0, successfulJobs: 0, failedJobs: 0, totalHours: 0 }
    );

    return response.successData(res, {
      rows: enriched,
      totals,
      dateRange: { start: startDate.toISOString(), end: endDate.toISOString() },
      groupBy,
    });
  } catch (error) {
    logger.error('[Usage] getUsageReport error:', error);
    return response.serverError(res, error.message);
  }
};

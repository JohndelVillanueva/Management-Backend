import React, { useState, useEffect } from "react";

const CardSubmissionAnalytics = () => {
  const [submissionStats, setSubmissionStats] = useState({
    totalCards: 0,
    submitted: 0,
    pending: 0,
    overdue: 0,
    completionRate: 0,
    avgSubmissionTime: "0 days",
  });

  const [realtimeMetrics, setRealtimeMetrics] = useState({
    activeTeachers: 0,
  });

  const [myCards, setMyCards] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [departmentStats, setDepartmentStats] = useState([]);
  const [departmentStorage, setDepartmentStorage] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch all data
const fetchData = async () => {
  try {
    const token = localStorage.getItem('token');
    
    if (!token) {
      throw new Error('No authentication token found');
    }

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // Create individual fetch promises with better error handling
    const endpoints = [
      { url: 'http://localhost:3000/activities/stats/overview', name: 'overview' },
      { url: 'http://localhost:3000/activities/stats/realtime', name: 'realtime' },
      { url: 'http://localhost:3000/cards/analytics/cards', name: 'cards' },
      { url: 'http://localhost:3000/activities/stats/departments', name: 'departments' },
      { url: 'http://localhost:3000/activities/recent?limit=8', name: 'recent' },
      { url: 'http://localhost:3000/departments/storage', name: 'storage' }
    ];

    const responses = await Promise.all(
      endpoints.map(endpoint => 
        fetch(endpoint.url, { headers })
          .then(async res => {
            if (!res.ok) {
              const errorText = await res.text();
              throw new Error(`${endpoint.name}: ${res.status} - ${errorText}`);
            }
            return res.json();
          })
      )
    );

    const [stats, realtime, cards, dept, activity, storage] = responses;

    setSubmissionStats(stats);
    setRealtimeMetrics(realtime);
    setMyCards(cards);
    setDepartmentStats(dept);
    setRecentActivity(activity);
    setDepartmentStorage(storage);
    setLoading(false);
  } catch (err) {
    console.error('Detailed fetch error:', err);
    setError(err.message);
    setLoading(false);
  }
};

  useEffect(() => {
    fetchData();

    // Refresh realtime metrics and activity every 10 seconds
    const interval = setInterval(() => {
      const token = localStorage.getItem('token');
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      fetch("http://localhost:3000/activities/stats/realtime", { headers })
        .then((res) => res.json())
        .then((data) => setRealtimeMetrics(data))
        .catch(console.error);

      fetch("http://localhost:3000/activities/recent?limit=8", { headers })
        .then((res) => res.json())
        .then((data) => setRecentActivity(data))
        .catch(console.error);

      fetch("http://localhost:3000/departments/storage", { headers })
        .then((res) => res.json())
        .then((data) => setDepartmentStorage(data))
        .catch(console.error);
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "Urgent":
        return "text-red-600 bg-red-100 border-red-300";
      case "High":
        return "text-orange-600 bg-orange-100 border-orange-300";
      case "Medium":
        return "text-yellow-600 bg-yellow-100 border-yellow-300";
      default:
        return "text-gray-600 bg-gray-100 border-gray-300";
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "Completed":
        return "text-green-600 bg-green-100 border-green-300";
      case "In Progress":
        return "text-blue-600 bg-blue-100 border-blue-300";
      case "Pending":
        return "text-orange-600 bg-orange-100 border-orange-300";
      case "Overdue":
        return "text-red-600 bg-red-100 border-red-300";
      default:
        return "text-gray-600 bg-gray-100 border-gray-300";
    }
  };

  const MetricCard = ({ title, value, subtitle, icon, color = "orange" }) => (
    <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-orange-500 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-base text-gray-600 mb-2">{title}</p>
          <h3 className="text-4xl font-bold text-gray-800">{value}</h3>
          {subtitle && <p className="text-sm text-gray-500 mt-2">{subtitle}</p>}
        </div>
        <div className={`bg-${color}-100 p-4 rounded-lg text-3xl`}>{icon}</div>
      </div>
    </div>
  );

  const RealtimeMetricCard = ({ title, value, unit, color }) => (
    <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <span className="text-base text-gray-600">{title}</span>
        <span className="text-orange-500 animate-pulse text-2xl">●</span>
      </div>
      <div className="flex items-baseline">
        <span className="text-4xl font-bold" style={{ color }}>
          {value}
        </span>
        <span className="text-base text-gray-500 ml-2">{unit}</span>
      </div>
      <div className="mt-3 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full transition-all duration-500"
          style={{
            width: `${typeof value === "number" ? Math.min(value, 100) : 50}%`,
            backgroundColor: color,
          }}
        />
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-xl text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-red-600">Error: {error}</p>
          <button
            onClick={fetchData}
            className="mt-4 px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-50 overflow-y-auto">
      <div className="w-full mx-auto p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-lg text-gray-600 mt-2">
                Administrator Dashboard • All Departments
              </p>
            </div>
            <div className="bg-orange-100 px-6 py-3 rounded-lg">
              <p className="text-base text-gray-600">Overall Completion</p>
              <p className="text-3xl font-bold text-orange-700">
                {submissionStats.completionRate}%
              </p>
            </div>
          </div>
        </div>

        {/* Real-time Metrics - Only Active Teachers */}
        <div className="mb-8 bg-orange-50 border border-orange-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold text-gray-800">
              Live Submission Activity
            </h2>
            <span className="flex items-center text-base text-gray-600">
              <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse mr-2"></span>
              Updating in real-time
            </span>
          </div>
          <div className="grid grid-cols-1">
            <RealtimeMetricCard
              title="Active Teachers"
              value={realtimeMetrics.activeTeachers}
              unit="online now"
              color="#f59e0b"
            />
          </div>
        </div>

        {/* Department Storage Data */}
        <div className="mb-8 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-semibold text-gray-800 mb-6">
            Department Stored Data
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {departmentStorage.length > 0 ? (
              departmentStorage.map((dept, idx) => (
                <div key={idx} className="border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-800">{dept.department}</h3>
                    <span className="text-3xl">📊</span>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Total Submissions</span>
                      <span className="text-lg font-bold text-gray-800">{dept.totalSubmissions || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Staff Members</span>
                      <span className="text-lg font-bold text-gray-800">{dept.staffCount || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Completed Cards</span>
                      <span className="text-lg font-bold text-green-600">{dept.completedCards || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Pending Cards</span>
                      <span className="text-lg font-bold text-orange-600">{dept.pendingCards || 0}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 mt-3">
                      <div
                        className="bg-green-500 h-3 rounded-full transition-all"
                        style={{ width: `${dept.completionRate || 0}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {dept.completionRate || 0}% completion rate
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full text-center text-gray-500 py-8">
                No department storage data available
              </div>
            )}
          </div>
        </div>

        {/* My Submission Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
          <MetricCard
            title="Total Cards Posted"
            value={submissionStats.totalCards}
            subtitle="Cards in the system"
            icon="📋"
          />
          <MetricCard
            title="Completed"
            value={submissionStats.submitted}
            subtitle="All staff submitted"
            icon="✅"
            color="green"
          />
          <MetricCard
            title="In Progress"
            value={submissionStats.pending}
            subtitle="Awaiting submissions"
            icon="⏳"
          />
          <MetricCard
            title="Overdue"
            value={submissionStats.overdue}
            subtitle="Past deadline"
            icon="⚠️"
            color="red"
          />
        </div>

        {/* My Cards Table */}
        <div className="bg-white rounded-lg shadow-md p-8 mb-8">
          <h3 className="text-2xl font-semibold text-gray-800 mb-6">
            All Posted Cards
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-medium text-gray-500 uppercase">
                    Card Title
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-gray-500 uppercase">
                    Posted By
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-gray-500 uppercase">
                    Deadline
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-gray-500 uppercase">
                    Priority
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-gray-500 uppercase">
                    Submissions
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-gray-500 uppercase">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {myCards.length > 0 ? (
                  myCards.map((card) => (
                    <tr key={card.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <span className="text-orange-500 mr-3 text-2xl">
                            📄
                          </span>
                          <span className="font-medium text-gray-800 text-base">
                            {card.title}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-base text-gray-600">
                        {card.postedBy}
                      </td>
                      <td className="px-6 py-4 text-base text-gray-600">
                        {card.deadline}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-3 py-1 text-sm rounded-full border ${getPriorityColor(
                            card.priority
                          )}`}
                        >
                          {card.priority}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-base font-medium text-gray-800">
                            {card.submissions} /{" "}
                            {card.totalStaff > 0 ? card.totalStaff : "N/A"}
                          </span>
                          <div className="w-24 bg-gray-200 rounded-full h-2 mt-1">
                            <div
                              className="bg-orange-500 h-2 rounded-full transition-all"
                              style={{
                                width: `${
                                  card.totalStaff > 0
                                    ? Math.min(
                                        (card.submissions / card.totalStaff) *
                                          100,
                                        100
                                      )
                                    : 0
                                }%`,
                              }}
                            />
                          </div>
                          {(!card.totalStaff || card.totalStaff === 0) && (
                            <span className="text-xs text-gray-500 mt-1">
                              No staff in department
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-3 py-1 text-sm rounded-full border ${getStatusColor(
                            card.status
                          )}`}
                        >
                          {card.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan="6"
                      className="px-6 py-8 text-center text-gray-500"
                    >
                      No cards found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Status Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* My Status Breakdown */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-xl font-semibold text-gray-800 mb-6">
              Overall Status Breakdown
            </h3>
            <div className="space-y-6">
              <div>
                <div className="flex justify-between text-base mb-2">
                  <span className="text-gray-600">Completed</span>
                  <span className="font-semibold text-green-600">
                    {submissionStats.submitted}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-4">
                  <div
                    className="bg-green-500 h-4 rounded-full transition-all"
                    style={{
                      width: `${
                        submissionStats.totalCards > 0
                          ? (submissionStats.submitted /
                              submissionStats.totalCards) *
                            100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-base mb-2">
                  <span className="text-gray-600">In Progress</span>
                  <span className="font-semibold text-orange-600">
                    {submissionStats.pending}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-4">
                  <div
                    className="bg-orange-500 h-4 rounded-full transition-all"
                    style={{
                      width: `${
                        submissionStats.totalCards > 0
                          ? (submissionStats.pending /
                              submissionStats.totalCards) *
                            100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-base mb-2">
                  <span className="text-gray-600">Overdue</span>
                  <span className="font-semibold text-red-600">
                    {submissionStats.overdue}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-4">
                  <div
                    className="bg-red-500 h-4 rounded-full transition-all"
                    style={{
                      width: `${
                        submissionStats.totalCards > 0
                          ? (submissionStats.overdue /
                              submissionStats.totalCards) *
                            100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Department Comparison */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-xl font-semibold text-gray-800 mb-6">
              Department Completion Rates
            </h3>
            <div className="space-y-6">
              {departmentStats.length > 0 ? (
                departmentStats.map((dept, idx) => (
                  <div key={idx}>
                    <div className="flex justify-between text-base mb-2">
                      <span className="text-gray-600">{dept.department}</span>
                      <span className="font-semibold text-orange-600">
                        {dept.rate}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-orange-500 h-3 rounded-full transition-all"
                        style={{ width: `${dept.rate}%` }}
                      />
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      {dept.submitted} / {dept.total} cards
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-center text-gray-500 py-4">
                  No department data
                </p>
              )}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-xl font-semibold text-gray-800 mb-6">
              Recent Submissions
            </h3>
            <div className="space-y-4">
              {recentActivity.length > 0 ? (
                recentActivity.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start space-x-3 pb-4 border-b last:border-b-0"
                  >
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-green-600 text-base">✓</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-base text-gray-800 font-medium truncate">
                        {activity.teacher}
                      </p>
                      <p className="text-sm text-gray-600">
                        {activity.action} • {activity.card}
                      </p>
                      <p className="text-sm text-gray-500">{activity.time}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-gray-500 py-4">
                  No recent activity
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Bottom spacing */}
        <div className="h-20"></div>
      </div>
    </div>
  );
};

export default CardSubmissionAnalytics;
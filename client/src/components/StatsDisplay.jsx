import React, { useState, useEffect } from 'react';
import { Modal, Button, Row, Col } from 'react-bootstrap';
import { Bar, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from 'chart.js';
import { BsGraphUp } from 'react-icons/bs';
import axios from 'axios';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const Statistics = () => {
  const [showStats, setShowStats] = useState(false);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  useEffect(() => {
    if (showStats) {
      fetchStats();
    }
  }, [showStats]);

  const fetchStats = async () => {
    try {
      const response = await axios.get('https://notes-cw4m.onrender.com/api/notes/stats');
      setStats(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching stats:', error);
      setLoading(false);
    }
  };

  const monthlyData = {
    labels: months,
    datasets: [{
      label: 'Notes Created',
      data: months.map((_, index) => {
        const monthStat = stats?.monthlyStats.find(stat => stat._id === index + 1);
        return monthStat ? monthStat.count : 0;
      }),
      backgroundColor: 'rgba(75, 192, 192, 0.6)',
      borderColor: 'rgba(75, 192, 192, 1)',
      borderWidth: 1
    }]
  };

  const tagData = {
    labels: stats?.tagStats.map(tag => tag._id) || [],
    datasets: [{
      data: stats?.tagStats.map(tag => tag.count) || [],
      backgroundColor: [
        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
        '#FF9F40', '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0'
      ]
    }]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        font: {
          size: 16
        }
      }
    }
  };

  return (
    <>
      <Button 
        variant="outline-info" 
        onClick={() => setShowStats(true)}
        className="stats-button"
      >
        <BsGraphUp /> Statistics
      </Button>

      <Modal
        show={showStats}
        onHide={() => setShowStats(false)}
        size="lg"
        className="stats-modal"
      >
        <Modal.Header closeButton>
          <Modal.Title>Notes Statistics</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {loading ? (
            <div className="text-center p-4">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          ) : (
            <Row>
              <Col xs={12} className="mb-4">
                <div className="chart-container">
                  <h5>Monthly Note Distribution</h5>
                  <Bar 
                    data={monthlyData} 
                    options={{
                      ...chartOptions,
                      plugins: {
                        ...chartOptions.plugins,
                        title: {
                          ...chartOptions.plugins.title,
                          text: 'Notes Created per Month'
                        }
                      }
                    }}
                  />
                </div>
              </Col>
              <Col xs={12}>
                <div className="chart-container">
                  <h5>Top Tags Distribution</h5>
                  <Pie 
                    data={tagData}
                    options={{
                      ...chartOptions,
                      plugins: {
                        ...chartOptions.plugins,
                        title: {
                          ...chartOptions.plugins.title,
                          text: 'Most Used Tags'
                        }
                      }
                    }}
                  />
                </div>
              </Col>
            </Row>
          )}
        </Modal.Body>
      </Modal>
    </>
  );
};

export default Statistics;
import { useEffect, useState } from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';
import { ArcElement, BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Tooltip } from 'chart.js';
import { getStats } from '../../api/notes';
import { useTheme } from '../../contexts/theme';
import Modal from '../ui/Modal';
import { ErrorState, LoadingState } from '../ui/States';

ChartJS.register(ArcElement, BarElement, CategoryScale, Legend, LinearScale, Tooltip);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Reads the palette from CSS variables so the charts follow light/dark mode.
const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export default function StatsModal({ onClose }) {
  const { theme } = useTheme();
  const [state, setState] = useState({ status: 'loading', stats: null, error: null });

  useEffect(() => {
    getStats()
      .then((stats) => setState({ status: 'success', stats, error: null }))
      .catch((error) => setState({ status: 'error', stats: null, error }));
  }, []);

  const { status, stats, error } = state;

  let body;
  if (status === 'loading') body = <LoadingState label="Loading insights…" />;
  else if (status === 'error') body = <ErrorState error={error} />;
  else {
    // Re-read colours whenever the theme changes.
    const colors = {
      theme,
      text: cssVar('--text-muted'),
      grid: cssVar('--border'),
      series: [1, 2, 3, 4, 5].map((n) => cssVar(`--chart-${n}`))
    };
    const totalNotes = stats.monthlyStats.reduce((sum, month) => sum + month.count, 0);
    const words = stats.wordCountStats;
    const axis = { ticks: { color: colors.text }, grid: { color: colors.grid } };

    body = (
      <div className="stack stack--loose">
        <dl className="stat-tiles">
          <div className="stat-tile">
            <dt>Notes</dt>
            <dd>{totalNotes}</dd>
          </div>
          <div className="stat-tile">
            <dt>Total words</dt>
            <dd>{words.totalWords.toLocaleString()}</dd>
          </div>
          <div className="stat-tile">
            <dt>Avg. words per note</dt>
            <dd>{Math.round(words.avgWordCount)}</dd>
          </div>
        </dl>

        <section>
          <h3 className="section__title">Notes created per month</h3>
          <div className="chart">
            <Bar
              data={{
                labels: MONTHS,
                datasets: [
                  {
                    label: 'Notes',
                    data: MONTHS.map((_, i) => stats.monthlyStats.find((m) => m._id === i + 1)?.count || 0),
                    backgroundColor: colors.series[0],
                    borderRadius: 4
                  }
                ]
              }}
              options={{
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { x: axis, y: { ...axis, beginAtZero: true, ticks: { ...axis.ticks, precision: 0 } } }
              }}
            />
          </div>
        </section>

        <section>
          <h3 className="section__title">Top tags</h3>
          {stats.tagStats.length === 0 ? (
            <p className="muted">No tags yet. Add #hashtags to your notes.</p>
          ) : (
            <div className="chart">
              <Doughnut
                data={{
                  labels: stats.tagStats.map((t) => `#${t._id}`),
                  datasets: [
                    {
                      data: stats.tagStats.map((t) => t.count),
                      backgroundColor: stats.tagStats.map((_, i) => colors.series[i % colors.series.length]),
                      borderColor: cssVar('--surface'),
                      borderWidth: 2
                    }
                  ]
                }}
                options={{ maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: colors.text } } } }}
              />
            </div>
          )}
        </section>
      </div>
    );
  }

  return (
    <Modal open title="Insights" onClose={onClose} size="lg">
      {body}
    </Modal>
  );
}

// src/components/features/SecurityActivity.jsx

const SecurityActivity = () => {
  return (
    <div className="configuracion-card configuracion-activity-card">
      <h3 className="configuracion-card-title">Actividad de Seguridad</h3>

      <div className="configuracion-activity-item">
        <div className="configuracion-activity-icon">🔒</div>

        <div className="configuracion-activity-info">
          <h4 className="configuracion-activity-title">Última sesión</h4>
          <p className="configuracion-activity-description">
            Hace 2 horas • IP: 192.168.1.1 • Chrome en Windows
          </p>
        </div>

        <span className="configuracion-badge active">Activa</span>
      </div>
    </div>
  );
};

export default SecurityActivity;
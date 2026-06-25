from flask import Flask, request, jsonify, g, send_from_directory
from flask_cors import CORS
import uuid
import logging
import os
from datetime import datetime

from nlp.nlp_engine import NLPEngine
from database.db_manager import DatabaseManager
from routes.chat_routes import chat_bp
from routes.faq_routes import faq_bp
from routes.feedback_routes import feedback_bp
from routes.auth_routes import auth_bp

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.abspath(os.path.join(BACKEND_DIR, '..', 'frontend'))

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}}, allow_headers=["Content-Type", "X-Session-ID"])

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger(__name__)

app.config.update(
    SECRET_KEY=os.environ.get("SECRET_KEY", "change-this-in-production"),
    MAX_CONTENT_LENGTH=1 * 1024 * 1024,
    SESSION_TIMEOUT=1800,
)

nlp_engine = NLPEngine()
db_manager  = DatabaseManager()

app.nlp_engine = nlp_engine
app.db_manager  = db_manager

app.register_blueprint(chat_bp,     url_prefix='/api')
app.register_blueprint(faq_bp,      url_prefix='/api')
app.register_blueprint(feedback_bp, url_prefix='/api')
app.register_blueprint(auth_bp,     url_prefix='/api')

@app.route('/')
def serve_index():
    return send_from_directory(FRONTEND_DIR, 'index.html')

@app.route('/<path:filename>')
def serve_static(filename):
    return send_from_directory(FRONTEND_DIR, filename)

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({
        "status":    "ok",
        "timestamp": datetime.utcnow().isoformat(),
        "nlp_ready": nlp_engine.is_ready(),
        "db_ready":  db_manager.is_connected()
    })

@app.before_request
def attach_session():
    g.session_id = request.headers.get('X-Session-ID') or str(uuid.uuid4())

@app.after_request
def add_headers(response):
    response.headers['X-Session-ID'] = g.get('session_id', '')
    return response

@app.errorhandler(400)
def bad_request(e):
    return jsonify({"error": "Bad request", "message": str(e)}), 400

@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Not found"}), 404

@app.errorhandler(500)
def server_error(e):
    logger.error(f"Server error: {e}")
    return jsonify({"error": "Internal server error"}), 500

if __name__ == '__main__':
    logger.info("Starting ICCT Chatbot back-end server…")
    app.run(host='0.0.0.0', port=5000, debug=True, use_reloader=False)

from flask import Blueprint, request, jsonify, current_app
import hashlib
import uuid

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/register', methods=['POST'])
def register():
    data              = request.get_json()
    first_name        = data.get('first_name', '').strip()
    last_name         = data.get('last_name', '').strip()
    email             = data.get('email', '').strip()
    student_id        = data.get('student_id', '').strip()
    password          = data.get('password', '')
    security_question = data.get('security_question', '').strip()
    security_answer   = data.get('security_answer', '').strip().lower()

    if not all([first_name, last_name, email, password]):
        return jsonify({"message": "All fields are required."}), 400

    db = current_app.db_manager
    existing = db.get_user_by_email(email)
    if existing:
        return jsonify({"message": "Email already registered."}), 409

    hashed = hashlib.sha256(password.encode()).hexdigest()
    db.create_user({
        "id":                str(uuid.uuid4()),
        "first_name":        first_name,
        "last_name":         last_name,
        "email":             email,
        "student_id":        student_id,
        "password":          hashed,
        "security_question": security_question,
        "security_answer":   security_answer
    })
    return jsonify({"message": "Account created successfully."}), 201

@auth_bp.route('/login', methods=['POST'])
def login():
    data     = request.get_json()
    email    = data.get('email', '').strip()
    password = data.get('password', '')

    if not all([email, password]):
        return jsonify({"message": "Email and password are required."}), 400

    db = current_app.db_manager
    user = db.get_user_by_email(email)
    if not user:
        return jsonify({"message": "Invalid email or password."}), 401

    hashed = hashlib.sha256(password.encode()).hexdigest()
    if user['password'] != hashed:
        return jsonify({"message": "Invalid email or password."}), 401

    token = str(uuid.uuid4())
    return jsonify({
        "message":    "Login successful.",
        "token":      token,
        "first_name": user['first_name'],
        "last_name":  user['last_name'],
        "email":      user['email'],
        "student_id": user.get('student_id', '')
    }), 200

@auth_bp.route('/security-question', methods=['POST'])
def get_security_question():
    """Return the security question for a given email."""
    data  = request.get_json()
    email = data.get('email', '').strip()

    if not email:
        return jsonify({"message": "Email is required."}), 400

    db   = current_app.db_manager
    user = db.get_user_by_email(email)

    if not user or not user.get('security_question'):
        return jsonify({"message": "No security question found for this email."}), 404

    return jsonify({"question": user['security_question']}), 200


@auth_bp.route('/verify-security-answer', methods=['POST'])
def verify_security_answer():
    """Verify the security answer and allow password reset."""
    data     = request.get_json()
    email    = data.get('email', '').strip()
    answer   = data.get('answer', '').strip().lower()
    password = data.get('password', '')

    if not all([email, answer, password]):
        return jsonify({"message": "All fields are required."}), 400

    if len(password) < 8:
        return jsonify({"message": "Password must be at least 8 characters."}), 400

    db   = current_app.db_manager
    user = db.get_user_by_email(email)

    if not user:
        return jsonify({"message": "Email not found."}), 404

    stored_answer = (user.get('security_answer') or '').strip().lower()
    if answer != stored_answer:
        return jsonify({"message": "Incorrect answer. Please try again."}), 401

    hashed = hashlib.sha256(password.encode()).hexdigest()
    db.update_password(email, hashed)

    return jsonify({"message": "Password reset successful! You can now log in."}), 200

import eventlet
eventlet.monkey_patch()

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room, leave_room
import psycopg2
from psycopg2.extras import DictCursor
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import os
import base64
import jwt
from datetime import datetime, timedelta
from werkzeug.utils import secure_filename
import pytz
import uuid
import smtplib
from email.mime.text import MIMEText
import random
import string
from apscheduler.schedulers.background import BackgroundScheduler
from dotenv import load_dotenv
from urllib.parse import urlparse
from supabase import create_client, Client

load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY')
CORS(app, resources={r"/api/*": {"origins": [
    "https://vite-react-ogq8-kwgnxw78d-shreyshakyas-projects.vercel.app",
    "http://localhost:5173",
    "http://localhost:3000"
]}})

EMAIL_ADDRESS = os.getenv('EMAIL_ADDRESS')
EMAIL_PASSWORD = os.getenv('EMAIL_PASSWORD')

# Initialize Flask-SocketIO
socketio = SocketIO(app, cors_allowed_origins="*")

# Configuration for file uploads (use cloud storage like Supabase Storage in production)
UPLOAD_FOLDER = 'uploads'
EVIDENCE_FOLDER = 'evidence'
COURT_FILES_FOLDER = 'court_files'
DOCUMENT_TEMPLATES_FOLDER = 'document_templates'
app.config['UPLOAD_FOLDER'] = os.getenv('UPLOAD_FOLDER', 'uploads')
KYC_FOLDER = 'kyc_documents'
app.config['KYC_FOLDER'] = os.getenv('KYC_FOLDER', 'kyc_documents')
os.makedirs(KYC_FOLDER, exist_ok=True)
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'pdf', 'doc', 'docx'}
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(EVIDENCE_FOLDER, exist_ok=True)
os.makedirs(COURT_FILES_FOLDER, exist_ok=True)
os.makedirs(DOCUMENT_TEMPLATES_FOLDER, exist_ok=True)

# Parse PostgreSQL URL
database_url = os.getenv('DATABASE_URL', 'postgresql://postgres:wceerabslqmefocz@db.rlhobympjuegouanbhfr.supabase.co:5432/postgres')
url = urlparse(database_url)
db_config = {
    'host': url.hostname,
    'port': url.port,
    'user': url.username,
    'password': url.password,
    'database': url.path[1:],
    'cursor_factory': DictCursor
}

SECRET_KEY = os.getenv('SECRET_KEY')

supabase_url = os.getenv('SUPABASE_URL')
supabase_key = os.getenv('SUPABASE_KEY')
supabase: Client = create_client(supabase_url, supabase_key)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def hash_password(password, salt=None):
    if salt is None:
        salt = os.urandom(16)
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=100000,
    )
    key = base64.urlsafe_b64encode(kdf.derive(password.encode()))
    return salt + key if salt else key

def verify_password(stored_password, provided_password):
    salt = stored_password[:16]
    stored_key = stored_password[16:]
    provided_key = hash_password(provided_password, salt)
    return stored_key == provided_key[16:]

def validate_token():
    token = request.headers.get('Authorization')
    if not token:
        return None, jsonify({'error': 'Token is missing'}), 401
    try:
        if token.startswith('Bearer '):
            token = token.split(' ')[1]
        decoded = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
        return decoded, None, None
    except jwt.ExpiredSignatureError:
        return None, jsonify({'error': 'Token has expired'}), 401
    except jwt.InvalidTokenError:
        return None, jsonify({'error': 'Invalid token'}), 401

def admin_required(func):
    def wrapper(*args, **kwargs):
        decoded, error_response, status = validate_token()
        if error_response:
            return error_response, status
        if 'admin_id' not in decoded:
            return jsonify({'error': 'Admin access required'}), 403
        return func(decoded['admin_id'], *args, **kwargs)
    wrapper.__name__ = func.__name__
    return wrapper

@app.route('/api/admin/register', methods=['POST'])
def register_admin():
    try:
        data = request.json
        username = data.get('username')
        email = data.get('email')
        password = data.get('password')
        if not all([username, email, password]):
            return jsonify({'error': 'Username, email, and password are required'}), 400
        hashed_bytes = hash_password(password)
        hashed_password = base64.b64encode(hashed_bytes).decode('utf-8')
        conn = psycopg2.connect(**db_config)
        try:
            with conn.cursor() as cursor:
                sql = """
                    INSERT INTO admins (username, email, password)
                    VALUES (%s, %s, %s)
                """
                cursor.execute(sql, (username, email, hashed_password))
                conn.commit()
        finally:
            conn.close()
        return jsonify({'message': 'Admin registered successfully'}), 201
    except psycopg2.IntegrityError:
        return jsonify({'error': 'Username or email already exists'}), 409
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@app.route('/api/admin/login', methods=['POST'])
def login_admin():
    try:
        data = request.json
        email = data.get('email')
        password = data.get('password')
        if not all([email, password]):
            return jsonify({'error': 'Email and password are required'}), 400
        conn = psycopg2.connect(**db_config)
        try:
            with conn.cursor() as cursor:
                sql = "SELECT * FROM admins WHERE email = %s"
                cursor.execute(sql, (email,))
                admin = cursor.fetchone()
        finally:
            conn.close()
        if not admin:
            return jsonify({'error': 'Invalid email or password'}), 401
        stored_password = base64.b64decode(admin['password'])
        if verify_password(stored_password, password):
            expiration_time = datetime.utcnow() + timedelta(hours=24)
            token_payload = {
                'admin_id': admin['id'],
                'email': admin['email'],
                'exp': int(expiration_time.timestamp())
            }
            token = jwt.encode(token_payload, SECRET_KEY, algorithm='HS256')
            return jsonify({
                'message': 'Login successful',
                'token': token,
                'admin': {
                    'id': admin['id'],
                    'username': admin['username'],
                    'email': admin['email']
                }
            }), 200
        else:
            return jsonify({'error': 'Invalid email or password'}), 401
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@app.route('/api/admin/upload-template', methods=['POST'])
@admin_required
def upload_template(admin_id):
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        if not allowed_file(file.filename):
            return jsonify({'error': 'Invalid file type. Allowed: pdf, doc, docx'}), 400
        # TODO: Replace with Supabase Storage upload
        original_filename = secure_filename(file.filename)
        extension = os.path.splitext(original_filename)[1]
        unique_filename = f"template_{uuid.uuid4().hex}{extension}"
        file_path = os.path.join(DOCUMENT_TEMPLATES_FOLDER, unique_filename)
        file.save(file_path)
        conn = psycopg2.connect(**db_config)
        try:
            with conn.cursor() as cursor:
                sql = """
                    INSERT INTO document_templates (filename, original_filename, uploaded_by)
                    VALUES (%s, %s, %s)
                """
                cursor.execute(sql, (unique_filename, original_filename, admin_id))
                conn.commit()
        finally:
            conn.close()
        return jsonify({'message': 'Template uploaded successfully'}), 201
    except psycopg2.IntegrityError:
        return jsonify({'error': 'Filename conflict in database'}), 409
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@app.route('/api/admin/lawyers', methods=['GET'])
@admin_required
def get_all_lawyers(admin_id):
    try:
        conn = psycopg2.connect(**db_config)
        try:
            with conn.cursor() as cursor:
                sql = """
                    SELECT id, name, email, specialization, location, availability_status, profile_picture, 
                           pro_bono_availability
                    FROM lawyers
                """
                cursor.execute(sql)
                lawyers = cursor.fetchall()
        finally:
            conn.close()
        for lawyer in lawyers:
            if lawyer['profile_picture']:
                lawyer['profile_picture'] = f"/uploads/{lawyer['profile_picture']}"
        return jsonify({'lawyers': lawyers}), 200
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@app.route('/api/admin/lawyers/<int:lawyer_id>', methods=['DELETE'])
@admin_required
def delete_lawyer(admin_id, lawyer_id):
    try:
        conn = psycopg2.connect(**db_config)
        try:
            with conn.cursor() as cursor:
                cursor.execute("SELECT id FROM lawyers WHERE id = %s", (lawyer_id,))
                if not cursor.fetchone():
                    return jsonify({'error': 'Lawyer not found'}), 404
                cursor.execute("DELETE FROM lawyers WHERE id = %s", (lawyer_id,))
                conn.commit()
        finally:
            conn.close()
        return jsonify({'message': 'Lawyer deleted successfully'}), 200
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@app.route('/api/admin/clients', methods=['GET'])
@admin_required
def get_all_clients(admin_id):
    try:
        conn = psycopg2.connect(**db_config)
        try:
            with conn.cursor() as cursor:
                sql = """
                    SELECT id, name, email, phone, address, profile_picture
                    FROM clients
                """
                cursor.execute(sql)
                clients = cursor.fetchall()
        finally:
            conn.close()
        for client in clients:
            if client['profile_picture']:
                client['profile_picture'] = f"/uploads/{client['profile_picture']}"
        return jsonify({'clients': clients}), 200
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@app.route('/api/admin/clients/<int:client_id>', methods=['DELETE'])
@admin_required
def delete_client(admin_id, client_id):
    try:
        conn = psycopg2.connect(**db_config)
        try:
            with conn.cursor() as cursor:
                cursor.execute("SELECT id FROM clients WHERE id = %s", (client_id,))
                if not cursor.fetchone():
                    return jsonify({'error': 'Client not found'}), 404
                cursor.execute("DELETE FROM clients WHERE id = %s", (client_id,))
                conn.commit()
        finally:
            conn.close()
        return jsonify({'message': 'Client deleted successfully'}), 200
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@app.route('/api/admin/cases', methods=['GET'])
@admin_required
def get_all_cases(admin_id):
    try:
        conn = psycopg2.connect(**db_config)
        try:
            with conn.cursor() as cursor:
                sql = """
                    SELECT c.id, c.title, c.case_type, c.status, c.created_at,
                           l.name AS lawyer_name, cl.name AS client_name
                    FROM cases c
                    JOIN lawyers l ON c.lawyer_id = l.id
                    JOIN clients cl ON c.client_id = cl.id
                """
                cursor.execute(sql)
                cases = cursor.fetchall()
        finally:
            conn.close()
        return jsonify({'cases': cases}), 200
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@app.route('/api/admin/cases/<int:case_id>', methods=['DELETE'])
@admin_required
def delete_case(admin_id, case_id):
    try:
        conn = psycopg2.connect(**db_config)
        try:
            with conn.cursor() as cursor:
                cursor.execute("SELECT id FROM cases WHERE id = %s", (case_id,))
                if not cursor.fetchone():
                    return jsonify({'error': 'Case not found'}), 404
                cursor.execute("DELETE FROM cases WHERE id = %s", (case_id,))
                conn.commit()
        finally:
            conn.close()
        return jsonify({'message': 'Case deleted successfully'}), 200
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@app.route('/api/admin/appointments', methods=['GET'])
@admin_required
def get_all_appointments(admin_id):
    try:
        conn = psycopg2.connect(**db_config)
        try:
            with conn.cursor() as cursor:
                sql = """
                    SELECT a.id, a.appointment_date, a.status, l.name AS lawyer_name, c.name AS client_name
                    FROM appointments a
                    JOIN lawyers l ON a.lawyer_id = l.id
                    JOIN clients c ON a.client_id = c.id
                """
                cursor.execute(sql)
                appointments = cursor.fetchall()
        finally:
            conn.close()
        return jsonify({'appointments': appointments}), 200
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@app.route('/api/admin/appointments/<int:appointment_id>', methods=['DELETE'])
@admin_required
def delete_appointment(admin_id, appointment_id):
    try:
        conn = psycopg2.connect(**db_config)
        try:
            with conn.cursor() as cursor:
                cursor.execute("SELECT id FROM appointments WHERE id = %s", (appointment_id,))
                if not cursor.fetchone():
                    return jsonify({'error': 'Appointment not found'}), 404
                cursor.execute("DELETE FROM appointments WHERE id = %s", (appointment_id,))
                conn.commit()
        finally:
            conn.close()
        return jsonify({'message': 'Appointment deleted successfully'}), 200
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@app.route('/api/admin/kyc-verifications', methods=['GET'])
@admin_required
def get_kyc_verifications(admin_id):
    try:
        status_filter = request.args.get('status', '')
        conn = psycopg2.connect(**db_config)
        try:
            with conn.cursor() as cursor:
                sql = """
                    SELECT k.id, k.lawyer_id, k.license_number, k.contact_number, k.identification_document, 
                           k.kyc_status, k.submitted_at, l.name AS lawyer_name, l.email AS lawyer_email
                    FROM kyc_verifications k
                    JOIN lawyers l ON k.lawyer_id = l.id
                    WHERE 1=1
                """
                params = []
                if status_filter:
                    sql += " AND k.kyc_status = %s"
                    params.append(status_filter)
                sql += " ORDER BY k.submitted_at DESC"
                cursor.execute(sql, params)
                kyc_records = cursor.fetchall()
        finally:
            conn.close()
        for record in kyc_records:
            if record['identification_document']:
                record['identification_document'] = f"/kyc_documents/{record['identification_document']}"
        return jsonify({'kyc_verifications': kyc_records}), 200
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@app.route('/api/admin/kyc-verifications/<int:kyc_id>/update-status', methods=['PUT'])
@admin_required
def update_kyc_status(admin_id, kyc_id):
    try:
        data = request.json
        new_status = data.get('status')
        if not new_status or new_status not in ['verified', 'rejected']:
            return jsonify({'error': 'Invalid status. Must be "verified" or "rejected"'}), 400
        conn = psycopg2.connect(**db_config)
        try:
            with conn.cursor() as cursor:
                cursor.execute("SELECT lawyer_id, kyc_status FROM kyc_verifications WHERE id = %s", (kyc_id,))
                kyc_record = cursor.fetchone()
                if not kyc_record:
                    return jsonify({'error': 'KYC record not found'}), 404
                lawyer_id = kyc_record['lawyer_id']
                cursor.execute(
                    "UPDATE kyc_verifications SET kyc_status = %s WHERE id = %s",
                    (new_status, kyc_id)
                )
                kyc_verified = new_status == 'verified'
                cursor.execute(
                    "UPDATE lawyers SET kyc_status = %s, kyc_verified = %s WHERE id = %s",
                    (new_status, kyc_verified, lawyer_id)
                )
                cursor.execute("SELECT email, name FROM lawyers WHERE id = %s", (lawyer_id,))
                lawyer = cursor.fetchone()
                conn.commit()
                if lawyer:
                    email_body = (
                        f"Dear {lawyer['name']},\n\n"
                        f"Your KYC verification has been {new_status}.\n"
                        f"{'You are now fully verified and can access all platform features.' if new_status == 'verified' else 'Please contact support for further details.'}\n\n"
                        f"Best regards,\nLegalAid Team"
                    )
                    if not send_email(lawyer['email'], f'KYC Verification {new_status.capitalize()}', email_body):
                        print(f"Failed to send KYC status email to {lawyer['email']}")
                socketio.emit('kyc_status_updated', {'kyc_status': new_status}, room=f"lawyer_{lawyer_id}")
        finally:
            conn.close()
        return jsonify({'message': f'KYC status updated to {new_status}'}), 200
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@app.route('/api/kyc_documents/<filename>')
@admin_required
def kyc_file(admin_id, filename):
    try:
        conn = psycopg2.connect(**db_config)
        try:
            with conn.cursor() as cursor:
                cursor.execute("SELECT identification_document FROM kyc_verifications WHERE identification_document = %s", (filename,))
                if not cursor.fetchone():
                    return jsonify({'error': 'File not found'}), 404
        finally:
            conn.close()
        # TODO: Serve file from Supabase Storage in production
        return send_from_directory(app.config['KYC_FOLDER'], filename)
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@app.route('/api/register-lawyer', methods=['POST'])
def register_lawyer():
    try:
        data = request.form
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        name = data.get('name')
        specialization = data.get('specialization')
        location = data.get('location')
        availability = data.get('availability')
        bio = data.get('bio')
        email = data.get('email')
        password = data.get('password')
        email_notifications = data.get('email_notifications', '1') == '1'
        availability_status = data.get('availability_status', 'Available')
        working_hours_start = data.get('working_hours_start', '09:00')
        working_hours_end = data.get('working_hours_end', '17:00')
        preferred_contact = data.get('preferred_contact', 'Email')
        is_otp_verified = data.get('is_otp_verified') == 'true'
        pro_bono_availability = data.get('pro_bono_availability', 'false').lower() == 'true'
        if not all([name, email, password]):
            return jsonify({'error': 'Name, email, and password are required'}), 400
        if not is_otp_verified:
            return jsonify({'error': 'OTP verification required'}), 400
        hashed_bytes = hash_password(password)
        hashed_password = base64.b64encode(hashed_bytes).decode('utf-8')
        profile_picture = None
        if 'profile_picture' in request.files:
            file = request.files['profile_picture']
            if file and allowed_file(file.filename):
                # TODO: Upload to Supabase Storage in production
                filename = secure_filename(file.filename)
                file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                file.save(file_path)
                profile_picture = filename
        conn = psycopg2.connect(**db_config)
        try:
            with conn.cursor() as cursor:
                sql = """
                    INSERT INTO lawyers (name, specialization, location, availability, bio, email, password, 
                        email_notifications, availability_status, working_hours_start, working_hours_end, 
                        preferred_contact, profile_picture, pro_bono_availability, kyc_status, kyc_verified)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id
                """
                cursor.execute(sql, (name, specialization, location, availability, bio, email, hashed_password,
                                     email_notifications, availability_status, working_hours_start, working_hours_end,
                                     preferred_contact, profile_picture, pro_bono_availability, 'pending', False))
                conn.commit()
        finally:
            conn.close()
        return jsonify({'message': 'Lawyer registered successfully'}), 201
    except psycopg2.IntegrityError:
        return jsonify({'error': 'Email already exists'}), 409
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@app.route('/api/login-lawyer', methods=['POST'])
def login_lawyer():
    try:
        data = request.json
        if not data:
            return jsonify({'error': 'No JSON data provided'}), 400
        email = data.get('email')
        password = data.get('password')
        if not all([email, password]):
            return jsonify({'error': 'Email and password are required'}), 400
        conn = psycopg2.connect(**db_config)
        try:
            with conn.cursor() as cursor:
                sql = "SELECT * FROM lawyers WHERE email = %s"
                cursor.execute(sql, (email,))
                lawyer = cursor.fetchone()
        finally:
            conn.close()
        if not lawyer:
            return jsonify({'error': 'Invalid email or password'}), 401
        stored_password = base64.b64decode(lawyer['password'])
        if verify_password(stored_password, password):
            expiration_time = datetime.utcnow() + timedelta(hours=24)
            token_payload = {
                'lawyer_id': lawyer['id'],
                'email': lawyer['email'],
                'exp': int(expiration_time.timestamp())
            }
            token = jwt.encode(token_payload, SECRET_KEY, algorithm='HS256')
            lawyer_response = lawyer.copy()
            if isinstance(lawyer['working_hours_start'], timedelta):
                lawyer_response['working_hours_start'] = str(lawyer['working_hours_start'])
            if isinstance(lawyer['working_hours_end'], timedelta):
                lawyer_response['working_hours_end'] = str(lawyer['working_hours_end'])
            if lawyer['profile_picture']:
                lawyer_response['profile_picture'] = f"/uploads/{lawyer['profile_picture']}"
            return jsonify({
                'message': 'Login successful',
                'token': token,
                'lawyer': lawyer_response
            }), 200
        else:
            return jsonify({'error': 'Invalid email or password'}), 401
    except Exception as e:
        print(f"Error during login: {str(e)}")
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@app.route('/api/lawyer-profile', methods=['GET', 'OPTIONS'])
def lawyer_profile():
    if request.method == "OPTIONS":
        return jsonify({}), 200
    decoded, error_response, status = validate_token()
    if error_response:
        return error_response, status
    try:
        lawyer_id = decoded['lawyer_id']
        conn = psycopg2.connect(**db_config)
        try:
            with conn.cursor() as cursor:
                sql = """
                    SELECT id, name, email, specialization, location, availability, bio, email_notifications, 
                           availability_status, working_hours_start, working_hours_end, preferred_contact, 
                           profile_picture, pro_bono_availability, kyc_status, kyc_verified
                    FROM lawyers WHERE id = %s
                """
                cursor.execute(sql, (lawyer_id,))
                lawyer = cursor.fetchone()
        finally:
            conn.close()
        if not lawyer:
            return jsonify({'error': 'Lawyer not found'}), 404
        lawyer_response = lawyer.copy()
        if isinstance(lawyer['working_hours_start'], timedelta):
            lawyer_response['working_hours_start'] = str(lawyer['working_hours_start'])
        if isinstance(lawyer['working_hours_end'], timedelta):
            lawyer_response['working_hours_end'] = str(lawyer['working_hours_end'])
        if lawyer['profile_picture']:
            lawyer_response['profile_picture'] = f"/uploads/{lawyer['profile_picture']}"
        return jsonify({'lawyer': lawyer_response}), 200
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@app.route('/api/lawyer-profile', methods=['PUT', 'OPTIONS'])
def update_lawyer_profile():
    if request.method == "OPTIONS":
        return jsonify({}), 200
    decoded, error_response, status = validate_token()
    if error_response:
        return error_response, status
    try:
        lawyer_id = decoded['lawyer_id']
        data = request.form
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        profile_picture = None
        if 'profile_picture' in request.files:
            file = request.files['profile_picture']
            if file and allowed_file(file.filename):
                # TODO: Upload to Supabase Storage in production
                filename = secure_filename(file.filename)
                file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                file.save(file_path)
                profile_picture = filename
        pro_bono_availability = data.get('pro_bono_availability', 'false').lower() == 'true'
        conn = psycopg2.connect(**db_config)
        try:
            with conn.cursor() as cursor:
                if not profile_picture:
                    cursor.execute("SELECT profile_picture FROM lawyers WHERE id = %s", (lawyer_id,))
                    current = cursor.fetchone()
                    profile_picture = current['profile_picture']
                sql = """
                    UPDATE lawyers 
                    SET specialization = %s, location = %s, availability = %s, bio = %s, 
                        email_notifications = %s, availability_status = %s, 
                        working_hours_start = %s, working_hours_end = %s, preferred_contact = %s,
                        profile_picture = %s, pro_bono_availability = %s
                    WHERE id = %s
                """
                cursor.execute(sql, (
                    data.get('specialization', ''),
                    data.get('location', ''),
                    data.get('availability', ''),
                    data.get('bio', ''),
                    data.get('email_notifications', '1') == '1',
                    data.get('availability_status', 'Available'),
                    data.get('working_hours_start', '09:00'),
                    data.get('working_hours_end', '17:00'),
                    data.get('preferred_contact', 'Email'),
                    profile_picture,
                    pro_bono_availability,
                    lawyer_id
                ))
                affected_rows = cursor.rowcount
                if affected_rows == 0:
                    return jsonify({'error': 'No rows updated, check lawyer_id or data'}), 400
                conn.commit()
                cursor.execute("""
                    SELECT id, name, email, specialization, location, availability, bio, email_notifications, 
                           availability_status, working_hours_start, working_hours_end, preferred_contact, 
                           profile_picture, pro_bono_availability
                    FROM lawyers WHERE id = %s
                """, (lawyer_id,))
                lawyer = cursor.fetchone()
        finally:
            conn.close()
        lawyer_response = lawyer.copy()
        if isinstance(lawyer['working_hours_start'], timedelta):
            lawyer_response['working_hours_start'] = str(lawyer['working_hours_start'])
        if isinstance(lawyer['working_hours_end'], timedelta):
            lawyer_response['working_hours_end'] = str(lawyer['working_hours_end'])
        if lawyer['profile_picture']:
            lawyer_response['profile_picture'] = f"/uploads/{lawyer['profile_picture']}"
        return jsonify({'lawyer': lawyer_response, 'message': 'Profile updated successfully'}), 200
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@app.route('/api/lawyer/change-password', methods=['PUT', 'OPTIONS'])
def change_password():
    if request.method == "OPTIONS":
        return jsonify({}), 200
    decoded, error_response, status = validate_token()
    if error_response:
        return error_response, status
    try:
        lawyer_id = decoded['lawyer_id']
        data = request.json
        if not data or 'current_password' not in data or 'new_password' not in data:
            return jsonify({'error': 'Current password and new password are required'}), 400
        current_password = data['current_password']
        new_password = data['new_password']
        if len(new_password) < 8:
            return jsonify({'error': 'New password must be at least 8 characters long'}), 400
        conn = psycopg2.connect(**db_config)
        try:
            with conn.cursor() as cursor:
                cursor.execute("SELECT password FROM lawyers WHERE id = %s", (lawyer_id,))
                lawyer = cursor.fetchone()
                if not lawyer:
                    return jsonify({'error': 'Lawyer not found'}), 404
                stored_password = base64.b64decode(lawyer['password'])
                if not verify_password(stored_password, current_password):
                    return jsonify({'error': 'Current password is incorrect'}), 401
                hashed_bytes = hash_password(new_password)
                hashed_new_password = base64.b64encode(hashed_bytes).decode('utf-8')
                cursor.execute(
                    "UPDATE lawyers SET password = %s WHERE id = %s",
                    (hashed_new_password, lawyer_id)
                )
                conn.commit()
        finally:
            conn.close()
        return jsonify({'message': 'Password updated successfully'}), 200
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    # TODO: Serve file from Supabase Storage in production
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/evidence/<filename>')
def evidence_file(filename):
    # TODO: Serve file from Supabase Storage in production
    return send_from_directory(EVIDENCE_FOLDER, filename)

@app.route('/court-files/<filename>')
def court_file(filename):
    # TODO: Serve file from Supabase Storage in production
    return send_from_directory(COURT_FILES_FOLDER, filename)

@app.route('/api/lawyer-cases', methods=['GET', 'OPTIONS'])
def lawyer_cases():
    if request.method == "OPTIONS":
        return jsonify({}), 200
    decoded, error_response, status = validate_token()
    if error_response:
        return error_response, status
    try:
        lawyer_id = decoded['lawyer_id']
        conn = psycopg2.connect(**db_config)
        try:
            with conn.cursor() as cursor:
                sql = """
                    SELECT c.id, c.title, c.case_type, c.description, c.status, c.created_at, c.priority,
                           c.filing_date, c.jurisdiction, c.plaintiff_name, c.defendant_name,
                           cl.name AS client_name
                    FROM cases c
                    JOIN clients cl ON c.client_id = cl.id
                    WHERE c.lawyer_id = %s
                """
                cursor.execute(sql, (lawyer_id,))
                cases = cursor.fetchall()
        finally:
            conn.close()
        return jsonify({'cases': cases}), 200
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@app.route('/api/lawyer-client-cases/<int:client_id>', methods=['GET', 'OPTIONS'])
def lawyer_client_cases(client_id):
    if request.method == "OPTIONS":
        return jsonify({}), 200
    decoded, error_response, status = validate_token()
    if error_response:
        return error_response, status
    try:
        lawyer_id = decoded['lawyer_id']
        conn = psycopg2.connect(**db_config)
        try:
            with conn.cursor() as cursor:
                sql = """
                    SELECT c.id, c.title, c.case_type, c.description, c.status, c.created_at, c.priority,
                           c.filing_date, c.jurisdiction, c.plaintiff_name, c.defendant_name
                    FROM cases c
                    WHERE c.lawyer_id = %s AND c.client_id = %s
                    ORDER BY c.created_at DESC
                """
                cursor.execute(sql, (lawyer_id, client_id))
                cases = cursor.fetchall()
        finally:
            conn.close()
        return jsonify({'cases': cases}), 200
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@app.route('/api/lawyer-case/<int:case_id>/update-status', methods=['PUT', 'OPTIONS'])
def update_case_status(case_id):
    if request.method == "OPTIONS":
        return jsonify({}), 200
    decoded, error_response, status = validate_token()
    if error_response:
        return error_response, status
    try:
        lawyer_id = decoded['lawyer_id']
        data = request.json
        if not data or 'status' not in data:
            return jsonify({'error': 'Status is required'}), 400
        new_status = data['status']
        if new_status not in ['pending', 'accepted', 'rejected', 'completed']:
            return jsonify({'error': 'Invalid status value'}), 400
        conn = psycopg2.connect(**db_config)
        try:
            with conn.cursor() as cursor:
                sql = "SELECT lawyer_id FROM cases WHERE id = %s"
                cursor.execute(sql, (case_id,))
                case = cursor.fetchone()
                if not case or case['lawyer_id'] != lawyer_id:
                    return jsonify({'error': 'Case not found or unauthorized'}), 403
                sql = "UPDATE cases SET status = %s WHERE id = %s"
                cursor.execute(sql, (new_status, case_id))
                conn.commit()
        finally:
            conn.close()
        return jsonify({'message': 'Case status updated successfully'}), 200
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@app.route('/api/register-client', methods=['POST'])
def register_client():
    try:
        data = request.form
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        name = data.get('name')
        email = data.get('email')
        password = data.get('password')
        phone = data.get('phone')
        is_otp_verified = data.get('is_otp_verified') == 'true'
        if not all([name, email, password]):
            return jsonify({'error': 'Name, email, and password are required'}), 400
        if not is_otp_verified:
            return jsonify({'error': 'OTP verification required'}), 400
        hashed_bytes = hash_password(password)
        hashed_password = base64.b64encode(hashed_bytes).decode('utf-8')
        profile_picture = None
        if 'profile_picture' in request.files:
            file = request.files['profile_picture']
            if file and allowed_file(file.filename):
                # TODO: Upload to Supabase Storage in production
                filename = secure_filename(file.filename)
                file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                file.save(file_path)
                profile_picture = filename
        conn = psycopg2.connect(**db_config)
        try:
            with conn.cursor() as cursor:
                sql = """
                    INSERT INTO clients (name, email, password, phone, address, bio, email_notifications, 
                                        preferred_contact, profile_picture)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id
                """
                cursor.execute(sql, (name, email, hashed_password, phone, '', '', True, 'Email', profile_picture))
                conn.commit()
        finally:
            conn.close()
        return jsonify({'message': 'Client registered successfully'}), 201
    except psycopg2.IntegrityError:
        return jsonify({'error': 'Email already exists'}), 409
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@app.route('/api/login-client', methods=['POST'])
def login_client():
    try:
        data = request.json
        if not data:
            return jsonify({'error': 'No JSON data provided'}), 400
        email = data.get('email')
        password = data.get('password')
        if not all([email, password]):
            return jsonify({'error': 'Email and password are required'}), 400
        conn = psycopg2.connect(**db_config)
        try:
            with conn.cursor() as cursor:
                sql = """
                    SELECT id, name, email, password, phone, address, bio, email_notifications, 
                           preferred_contact, profile_picture
                    FROM clients WHERE email = %s
                """
                cursor.execute(sql, (email,))
                client = cursor.fetchone()
        finally:
            conn.close()
        if not client:
            return jsonify({'error': 'Invalid email or password'}), 401
        stored_password = base64.b64decode(client['password'])
        if verify_password(stored_password, password):
            expiration_time = datetime.utcnow() + timedelta(hours=24)
            token_payload = {
                'client_id': client['id'],
                'email': client['email'],
                'exp': int(expiration_time.timestamp())
            }
            token = jwt.encode(token_payload, SECRET_KEY, algorithm='HS256')
            client_response = client.copy()
            if client['profile_picture']:
                client_response['profile_picture'] = f"/uploads/{client['profile_picture']}"
            del client_response['password']
            return jsonify({
                'message': 'Login successful',
                'token': token,
                'client': client_response
            }), 200
        else:
            return jsonify({'error': 'Invalid email or password'}), 401
    except Exception as e:
        print(f"Error during login: {str(e)}")
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@app.route('/api/lawyers', methods=['GET'])
def get_lawyers():
    try:
        specialization = request.args.get('specialization', '')
        location = request.args.get('location', '')
        availability_status = request.args.get('availability_status', '')
        min_rating = request.args.get('min_rating', '')
        pro_bono_availability = request.args.get('pro_bono_availability', '')
        conn = psycopg2.connect(**db_config)
        try:
            with conn.cursor() as cursor:
                sql = """
                    SELECT id, name, specialization, location, availability, bio, 
                           email_notifications, availability_status, working_hours_start, 
                           working_hours_end, preferred_contact, profile_picture, rating, 
                           pro_bono_availability
                    FROM lawyers
                    WHERE kyc_verified = TRUE
                """
                params = []
                if specialization:
                    sql += " AND specialization LIKE %s"
                    params.append(f"%{specialization}%")
                if location:
                    sql += " AND location LIKE %s"
                    params.append(f"%{location}%")
                if availability_status:
                    sql += " AND availability_status = %s"
                    params.append(availability_status)
                if min_rating:
                    sql += " AND rating >= %s"
                    params.append(float(min_rating))
                if pro_bono_availability:
                    sql += " AND pro_bono_availability = %s"
                    params.append(pro_bono_availability.lower() == 'true')
                cursor.execute(sql, params)
                lawyers = cursor.fetchall()
        finally:
            conn.close()
        lawyers_response = []
        for lawyer in lawyers:
            lawyer_dict = lawyer.copy()
            if isinstance(lawyer['working_hours_start'], timedelta):
                lawyer_dict['working_hours_start'] = str(lawyer['working_hours_start'])
            if isinstance(lawyer['working_hours_end'], timedelta):
                lawyer_dict['working_hours_end'] = str(lawyer['working_hours_end'])
            if lawyer['profile_picture']:
                lawyer_dict['profile_picture'] = f"/uploads/{lawyer['profile_picture']}"
            lawyers_response.append(lawyer_dict)
        return jsonify({'lawyers': lawyers_response}), 200
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@app.route('/api/lawyer/<int:lawyer_id>', methods=['GET'])
def get_lawyer(lawyer_id):
    try:
        conn = psycopg2.connect(**db_config)
        try:
            with conn.cursor() as cursor:
                sql = """
                    SELECT id, name, specialization, location, availability, bio, 
                           email_notifications, availability_status, working_hours_start, 
                           working_hours_end, preferred_contact, profile_picture, rating, 
                           pro_bono_availability
                    FROM lawyers
                    WHERE id = %s
                """
                cursor.execute(sql, (lawyer_id,))
                lawyer = cursor.fetchone()
        finally:
            conn.close()
        if not lawyer:
            return jsonify({'error': 'Lawyer not found'}), 404
        lawyer_response = lawyer.copy()
        if isinstance(lawyer['working_hours_start'], timedelta):
            lawyer_response['working_hours_start'] = str(lawyer['working_hours_start'])
        if isinstance(lawyer['working_hours_end'], timedelta):
            lawyer_response['working_hours_end'] = str(lawyer['working_hours_end'])
        if lawyer['profile_picture']:
            lawyer_response['profile_picture'] = f"/uploads/{lawyer['profile_picture']}"
        return jsonify({'lawyer': lawyer_response}), 200
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@app.route('/api/book-appointment', methods=['POST', 'OPTIONS'])
def book_appointment():
    if request.method == "OPTIONS":
        return jsonify({}), 200
    decoded, error_response, status = validate_token()
    if error_response:
        return error_response, status
    try:
        client_id = decoded['client_id']
        data = request.json
        lawyer_id = data.get('lawyer_id')
        appointment_date_str = data.get('appointment_date')
        if not all([lawyer_id, appointment_date_str]):
            return jsonify({'error': 'Lawyer ID and appointment date are required'}), 400
        try:
            appointment_date = datetime.fromisoformat(appointment_date_str.replace('Z', '+00:00'))
            nepal_tz = pytz.timezone('Asia/Kathmandu')
            appointment_date_nepal = appointment_date.astimezone(nepal_tz)
        except ValueError:
            return jsonify({'error': 'Invalid appointment date format'}), 400
        conn = psycopg2.connect(**db_config)
        try:
            with conn.cursor() as cursor:
                conn.begin()
                cursor.execute("SELECT id FROM lawyers WHERE id = %s", (lawyer_id,))
                lawyer = cursor.fetchone()
                if not lawyer:
                    conn.rollback()
                    return jsonify({'error': 'Lawyer not found'}), 404
                cursor.execute("""
                    SELECT appointment_date 
                    FROM appointments 
                    WHERE lawyer_id = %s 
                    AND status != 'cancelled'
                """, (lawyer_id,))
                existing_appointments = cursor.fetchall()
                for appt in existing_appointments:
                    existing_date = appt['appointment_date']
                    if existing_date.tzinfo is None:
                        existing_date = pytz.UTC.localize(existing_date)
                    existing_date_nepal = existing_date.astimezone(nepal_tz)
                    time_diff = abs((appointment_date_nepal - existing_date_nepal).total_seconds()) / 60
                    if time_diff < 30:
                        conn.rollback()
                        return jsonify({'error': 'This time slot is already booked. Please choose another time.'}), 409
                sql = """
                    INSERT INTO appointments (client_id, lawyer_id, appointment_date)
                    VALUES (%s, %s, %s)
                    RETURNING id
                """
                cursor.execute(sql, (client_id, lawyer_id, appointment_date_nepal))
                appointment_id = cursor.fetchone()['id']
                conn.commit()
                cursor.execute("""
                    SELECT a.id, a.appointment_date, a.status, a.created_at, 
                           l.name AS lawyer_name, c.name AS client_name
                    FROM appointments a
                    JOIN lawyers l ON a.lawyer_id = l.id
                    JOIN clients c ON a.client_id = c.id
                    WHERE a.id = %s
                """, (appointment_id,))
                new_appointment = cursor.fetchone()
                if new_appointment:
                    new_appointment['appointment_date'] = new_appointment['appointment_date'].astimezone(nepal_tz).isoformat()
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            conn.close()
        return jsonify({'message': 'Appointment booked successfully', 'appointment': new_appointment}), 201
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@app.route('/api/client-appointments', methods=['GET', 'OPTIONS'])
def get_client_appointments():
    if request.method == "OPTIONS":
        return jsonify({}), 200
    decoded, error_response, status = validate_token()
    if error_response:
        return error_response, status
    try:
        client_id = decoded['client_id']
        nepal_tz = pytz.timezone('Asia/Kathmandu')
        conn = psycopg2.connect(**db_config)
        try:
            with conn.cursor() as cursor:
                sql = """
                    SELECT a.id, a.appointment_date, a.status, a.created_at, 
                           l.name AS lawyer_name, l.specialization
                    FROM appointments a
                    JOIN lawyers l ON a.lawyer_id = l.id
                    WHERE a.client_id = %s
                    ORDER BY a.appointment_date DESC
                """
                cursor.execute(sql, (client_id,))
                appointments = cursor.fetchall()
                for appt in appointments:
                    if appt['appointment_date'].tzinfo is None:
                        appt['appointment_date'] = pytz.UTC.localize(appt['appointment_date'])
                    appt['appointment_date'] = appt['appointment_date'].astimezone(nepal_tz).isoformat()
                    if isinstance(appt['created_at'], datetime):
                        appt['created_at'] = appt['created_at'].astimezone(nepal_tz).isoformat()
        finally:
            conn.close()
        return jsonify({'appointments': appointments}), 200
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@app.route('/api/lawyer-appointments/<int:lawyer_id>', methods=['GET', 'OPTIONS'])
def get_lawyer_appointments(lawyer_id):
    if request.method == "OPTIONS":
        return jsonify({}), 200
    decoded, error_response, status = validate_token()
    if error_response:
        return error_response, status
    try:
        nepal_tz = pytz.timezone('Asia/Kathmandu')
        conn = psycopg2.connect(**db_config)
        try:
            with conn.cursor() as cursor:
                sql = """
                    SELECT a.id, a.client_id, a.lawyer_id, a.appointment_date, a.status, a.created_at, 
                           c.name AS client_name
                    FROM appointments a
                    JOIN clients c ON a.client_id = c.id
                    WHERE a.lawyer_id = %s
                    ORDER BY a.appointment_date DESC
                """
                cursor.execute(sql, (lawyer_id,))
                appointments = cursor.fetchall()
                for appt in appointments:
                    if appt['appointment_date'].tzinfo is None:
                        appt['appointment_date'] = nepal_tz.localize(appt['appointment_date'])
                    appt['appointment_date'] = appt['appointment_date'].isoformat()
                    if isinstance(appt['created_at'], datetime) and appt['created_at'].tzinfo is None:
                        appt['created_at'] = pytz.UTC.localize(appt['created_at']).astimezone(nepal_tz)
                        appt['created_at'] = appt['created_at'].isoformat()
        finally:
            conn.close()
        return jsonify({'appointments': appointments}), 200
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@app.route('/api/update-appointment-status/<int:appointment_id>', methods=['PUT', 'OPTIONS'])
def update_appointment_status(appointment_id):
    if request.method == "OPTIONS":
        return jsonify({}), 200
    decoded, error_response, status = validate_token()
    if error_response:
        return error_response, status
    try:
        lawyer_id = decoded['lawyer_id']
        data = request.json
        if not data or 'status' not in data:
            return jsonify({'error': 'Status is required'}), 400
        new_status = data['status']
        if new_status not in ['confirmed', 'cancelled']:
            return jsonify({'error': 'Invalid status value'}), 400
        conn = psycopg2.connect(**db_config)
        try:
            with conn.cursor() as cursor:
                sql = """
                    SELECT a.id, a.appointment_date, c.email, c.name
                    FROM appointments a
                    JOIN clients c ON a.client_id = c.id
                    WHERE a.id = %s AND a.lawyer_id = %s
                """
                cursor.execute(sql, (appointment_id, lawyer_id))
                appointment = cursor.fetchone()
                if not appointment:
                    return jsonify({'error': 'Appointment not found or unauthorized'}), 403
                sql = """
                    UPDATE appointments 
                    SET status = %s, reminder_sent = %s 
                    WHERE id = %s
                """
                cursor.execute(sql, (new_status, new_status == 'cancelled', appointment_id))
                conn.commit()
                if new_status == 'confirmed':
                    appointment_date = appointment['appointment_date']
                    client_email = appointment['email']
                    client_name = appointment['name']
                    nepal_tz = pytz.timezone('Asia/Kathmandu')
                    if appointment_date.tzinfo is None:
                        appointment_date = nepal_tz.localize(appointment_date)
                    formatted_date = appointment_date.strftime('%B %d, %Y at %I:%M %p %Z')
                    email_body = (
                        f"Dear {client_name},\n\n"
                        f"Your appointment has been confirmed.\n"
                        f"Details:\n"
                        f"Date and Time: {formatted_date}\n\n"
                        f"Thank you for choosing LegalAid.\n"
                        f"Best regards,\nLegalAid Team"
                    )
                    if not send_email(client_email, 'LegalAid Appointment Confirmation', email_body):
                        print(f"Failed to send confirmation email to {client_email}")
        finally:
            conn.close()
        return jsonify({'message': f'Appointment {new_status} successfully'}), 200
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@app.route('/api/create-case', methods=['POST', 'OPTIONS'])
def create_case():
    if request.method == "OPTIONS":
        return jsonify({}), 200
    decoded, error_response, status = validate_token()
    if error_response:
        return error_response, status
    try:
        lawyer_id = decoded['lawyer_id']
        data = request.json
        if not data:
            return jsonify({'error': 'No JSON data provided'}), 400
        client_id = data.get('client_id')
        title = data.get('title')
        case_type = data.get('case_type')
        status = data.get('status', 'pending')
        filing_date = data.get('filing_date')
        jurisdiction = data.get('jurisdiction')
        description = data.get('description')
        plaintiff_name = data.get('plaintiff_name')
        defendant_name = data.get('defendant_name')
        priority = data.get('priority', 'Medium')
        if not all([client_id, title, case_type, filing_date, jurisdiction, plaintiff_name, defendant_name]):
            return jsonify({'error': 'Client ID, title, case type, filing date, jurisdiction, plaintiff name, and defendant name are required'}), 400
        if status not in ['pending', 'accepted', 'rejected', 'completed']:
            return jsonify({'error': 'Invalid status value'}), 400
        if priority not in ['Low', 'Medium', 'High']:
            return jsonify({'error': 'Invalid priority value'}), 400
        conn = psycopg2.connect(**db_config)
        try:
            with conn.cursor() as cursor:
                cursor.execute("SELECT id FROM clients WHERE id = %s", (client_id,))
                client = cursor.fetchone()
                if not client:
                    return jsonify({'error': 'Client not found'}), 404
                sql = """
                    INSERT INTO cases (lawyer_id, client_id, title, case_type, status, filing_date, jurisdiction, description, plaintiff_name, defendant_name, priority)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id
                """
                cursor.execute(sql, (lawyer_id, client_id, title, case_type, status, filing_date, jurisdiction, description, plaintiff_name, defendant_name, priority))
                conn.commit()
        finally:
            conn.close()
        return jsonify({'message': 'Case created successfully'}), 201
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@app.route('/api/case/<int:case_id>', methods=['GET'])
def get_case(case_id):
    decoded, error_response, status = validate_token()
    if error_response:
        return error_response, status
    try:
        lawyer_id = decoded['lawyer_id']
        conn = psycopg2.connect(**db_config)
        try:
            with conn.cursor() as cursor:
                sql = """
                    SELECT c.*, l.name AS lawyer_name, cl.name AS client_name, cl.email AS client_contact_info
                    FROM cases c
                    JOIN lawyers l ON c.lawyer_id = l.id
                    JOIN clients cl ON c.client_id = cl.id
                    WHERE c.id = %s AND c.lawyer_id = %s
                """
                cursor.execute(sql, (case_id, lawyer_id))
                case_data = cursor.fetchone()
                if not case_data:
                    return jsonify({'error': 'Case not found or unauthorized'}), 403
                cursor.execute(
                    "SELECT id, progress_event, event_date, created_at FROM case_timeline WHERE case_id = %s ORDER BY event_date ASC",
                    (case_id,)
                )
                timeline = cursor.fetchall()
                cursor.execute(
                    "SELECT id, file_path, uploaded_at FROM court_files WHERE case_id = %s",
                    (case_id,)
                )
                documents = cursor.fetchall()
                cursor.execute(
                    "SELECT id, file_path, description, reviewed, uploaded_at FROM evidence_files WHERE case_id = %s",
                    (case_id,)
                )
                evidence = cursor.fetchall()
                cursor.execute(
                    "SELECT id, sender, message, created_at FROM case_messages WHERE case_id = %s ORDER BY created_at ASC",
                    (case_id,)
                )
                messages = cursor.fetchall()
        finally:
            conn.close()
        return jsonify({
            'case': case_data,
            'timeline': timeline,
            'documents': documents,
            'evidence': evidence,
            'messages': messages
        }), 200
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@app.route('/api/case/<int:case_id>', methods=['PUT', 'OPTIONS'])
def update_case(case_id):
    if request.method == "OPTIONS":
        return jsonify({}), 200
    decoded, error_response, status = validate_token()
    if error_response:
        return error_response, status
    try:
        lawyer_id = decoded['lawyer_id']
        data = request.json
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        case_status = data.get('case_status', 'pending')
        next_hearing_date = data.get('next_hearing_date') or None
        conn = psycopg2.connect(**db_config)
        try:
            with conn.cursor() as cursor:
                cursor.execute("SELECT lawyer_id FROM cases WHERE id = %s", (case_id,))
                case = cursor.fetchone()
                if not case or case['lawyer_id'] != lawyer_id:
                    return jsonify({'error': 'Case not found or unauthorized'}), 403
                cursor.execute(
                    "UPDATE cases SET status = %s, next_hearing_date = %s WHERE id = %s",
                    (case_status, next_hearing_date, case_id)
                )
                conn.commit()
                cursor.execute("""
                    SELECT c.*, l.name AS lawyer_name, cl.name AS client_name, cl.email AS client_contact_info
                    FROM cases c
                    JOIN lawyers l ON c.lawyer_id = l.id
                    JOIN clients cl ON c.client_id = cl.id
                    WHERE c.id = %s
                """, (case_id,))
                updated_case = cursor.fetchone()
        finally:
            conn.close()
        return jsonify({'case': updated_case, 'message': 'Case updated successfully'}), 200
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@app.route('/api/case/<int:case_id>/timeline', methods=['POST'])
def add_timeline_event(case_id):
    decoded, error_response, status = validate_token()
    if error_response:
        return error_response, status
    try:
        lawyer_id = decoded['lawyer_id']
        data = request.json
        if not data or 'progress_event' not in data or 'event_date' not in data:
            return jsonify({'error': 'Progress event and event date are required'}), 400
        progress_event = data['progress_event']
        event_date = data['event_date']
        conn = psycopg2.connect(**db_config)
        try:
            with conn.cursor() as cursor:
                cursor.execute("SELECT lawyer_id, client_id FROM cases WHERE id = %s", (case_id,))
                case = cursor.fetchone()
                if not case or case['lawyer_id'] != lawyer_id:
                    return jsonify({'error': 'Case not found or unauthorized'}), 403
                cursor.execute(
                    "INSERT INTO case_timeline (case_id, progress_event, event_date) VALUES (%s, %s, %s) RETURNING id",
                    (case_id, progress_event, event_date)
                )
                event_id = cursor.fetchone()['id']
                cursor.execute("SELECT email, name FROM clients WHERE id = %s", (case['client_id'],))
                client = cursor.fetchone()
                if client:
                    event_date_dt = datetime.fromisoformat(event_date.replace('Z', '+00:00'))
                    formatted_date = event_date_dt.astimezone(pytz.timezone('Asia/Kathmandu')).strftime('%B %d, %Y')
                    email_body = (
                        f"Dear {client['name']},\n\n"
                        f"A new update has been added to your case:\n"
                        f"Event: {progress_event}\n"
                        f"Date: {formatted_date}\n\n"
                        f"Please log in to the LegalAid platform to view details.\n"
                        f"Best regards,\nLegalAid Team"
                    )
                    if not send_email(client['email'], 'New Case Update', email_body):
                        print(f"Failed to send timeline update email to {client['email']}")
                conn.commit()
                cursor.execute(
                    "SELECT id, progress_event, event_date, created_at FROM case_timeline WHERE id = %s",
                    (event_id,)
                )
                new_event = cursor.fetchone()
        finally:
            conn.close()
        return jsonify({'event': new_event, 'message': 'Timeline event added successfully'}), 201
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@app.route('/api/case/<int:case_id>/documents', methods=['POST'])
def upload_document(case_id):
    decoded, error_response, status = validate_token()
    if error_response:
        return error_response, status
    try:
        lawyer_id = decoded['lawyer_id']
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        file = request.files['file']
        if file and allowed_file(file.filename):
            # TODO: Upload to Supabase Storage in production
            filename = secure_filename(file.filename)
            file_path = os.path.join(COURT_FILES_FOLDER, filename)
            file.save(file_path)
            conn = psycopg2.connect(**db_config)
            try:
                with conn.cursor() as cursor:
                    cursor.execute("SELECT lawyer_id, client_id FROM cases WHERE id = %s", (case_id,))
                    case = cursor.fetchone()
                    if not case or case['lawyer_id'] != lawyer_id:
                        return jsonify({'error': 'Case not found or unauthorized'}), 403
                    cursor.execute(
                        "INSERT INTO court_files (case_id, file_path) VALUES (%s, %s) RETURNING id",
                        (case_id, filename)
                    )
                    document_id = cursor.fetchone()['id']
                    cursor.execute("SELECT email, name FROM clients WHERE id = %s", (case['client_id'],))
                    client = cursor.fetchone()
                    if client:
                        email_body = (
                            f"Dear {client['name']},\n\n"
                            f"A new document has been uploaded to your case:\n"
                            f"File: {filename}\n\n"
                            f"Please log in to the LegalAid platform to view it.\n"
                            f"Best regards,\nLegalAid Team"
                        )
                        if not send_email(client['email'], 'A New Document Has Been Uploaded to Your Case', email_body):
                            print(f"Failed to send document upload email to {client['email']}")
                    conn.commit()
                    cursor.execute(
                        "SELECT id, file_path, uploaded_at FROM court_files WHERE id = %s",
                        (document_id,)
                    )
                    new_document = cursor.fetchone()
            finally:
                conn.close()
            return jsonify({'document': new_document, 'message': 'Document uploaded successfully'}), 201
        else:
            return jsonify({'error': 'Invalid file type'}), 400
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@app.route('/api/case/<int:case_id>/documents/<int:document_id>', methods=['DELETE'])
def delete_document(case_id, document_id):
    decoded, error_response, status = validate_token()
    if error_response:
        return error_response, status
    try:
        lawyer_id = decoded['lawyer_id']
        conn = psycopg2.connect(**db_config)
        try:
            with conn.cursor() as cursor:
                cursor.execute("SELECT lawyer_id FROM cases WHERE id = %s", (case_id,))
                case = cursor.fetchone()
                if not case or case['lawyer_id'] != lawyer_id:
                    return jsonify({'error': 'Case not found or unauthorized'}), 403
                cursor.execute("SELECT file_path FROM court_files WHERE id = %s AND case_id = %s", (document_id, case_id))
                document = cursor.fetchone()
                if not document:
                    return jsonify({'error': 'Document not found'}), 404
                # TODO: Delete from Supabase Storage in production
                file_path = os.path.join(COURT_FILES_FOLDER, document['file_path'])
                if os.path.exists(file_path):
                    os.remove(file_path)
                cursor.execute("DELETE FROM court_files WHERE id = %s AND case_id = %s", (document_id, case_id))
                conn.commit()
        finally:
            conn.close()
        return jsonify({'message': 'Document deleted successfully'}), 200
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@app.route('/api/case/<int:case_id>/evidence', methods=['POST'])
def add_evidence(case_id):
    decoded, error_response, status = validate_token()
    if error_response:
        return error_response, status
    try:
        lawyer_id = decoded['lawyer_id']
        description = request.form.get('description', '')
        if not description:
            return jsonify({'error': 'Description is required'}), 400
        file = request.files.get('file')
        file_path = None
        if file and allowed_file(file.filename):
            # TODO: Upload to Supabase Storage in production
            filename = secure_filename(file.filename)
            file_path = os.path.join(EVIDENCE_FOLDER, filename)
            file.save(file_path)
            file_path = filename
        conn = psycopg2.connect(**db_config)
        try:
            with conn.cursor() as cursor:
                cursor.execute("SELECT lawyer_id, client_id FROM cases WHERE id = %s", (case_id,))
                case = cursor.fetchone()
                if not case or case['lawyer_id'] != lawyer_id:
                    return jsonify({'error': 'Case not found or unauthorized'}), 403
                cursor.execute(
                    "INSERT INTO evidence_files (case_id, file_path, description, reviewed) VALUES (%s, %s, %s, %s) RETURNING id",
                    (case_id, file_path, description, False)
                )
                evidence_id = cursor.fetchone()['id']
                cursor.execute("SELECT email, name FROM clients WHERE id = %s", (case['client_id'],))
                client = cursor.fetchone()
                if client:
                    email_body = (
                        f"Dear {client['name']},\n\n"
                        f"A new document has been uploaded to your case:\n"
                        f"Description: {description}\n"
                        f"{f'File: {filename}' if file_path else ''}\n\n"
                        f"Please log in to the LegalAid platform to view it.\n"
                        f"Best regards,\nLegalAid Team"
                    )
                    if not send_email(client['email'], 'A New Document Has Been Uploaded to Your Case', email_body):
                        print(f"Failed to send evidence upload email to {client['email']}")
                conn.commit()
                cursor.execute(
                    "SELECT id, file_path, description, reviewed, uploaded_at FROM evidence_files WHERE id = %s",
                    (evidence_id,)
                )
                new_evidence = cursor.fetchone()
        finally:
            conn.close()
        return jsonify({'evidence': new_evidence, 'message': 'Evidence added successfully'}), 201
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@app.route('/api/case/<int:case_id>/evidence/<int:evidence_id>/review', methods=['PUT'])
def mark_evidence_reviewed(case_id, evidence_id):
    decoded, error_response, status = validate_token()
    if error_response:
        return error_response, status
    try:
        lawyer_id = decoded['lawyer_id']
        conn = psycopg2.connect(**db_config)
        try:
            with conn.cursor() as cursor:
                cursor.execute("SELECT lawyer_id FROM cases WHERE id = %s", (case_id,))
                case = cursor.fetchone()
                if not case or case['lawyer_id'] != lawyer_id:
                    return jsonify({'error': 'Case not found or unauthorized'}), 403
                cursor.execute("SELECT id FROM evidence_files WHERE id = %s AND case_id = %s", (evidence_id, case_id))
                evidence = cursor.fetchone()
                if not evidence:
                    return jsonify({'error': 'Evidence not found'}), 404
                cursor.execute(
                    "UPDATE evidence_files SET reviewed = TRUE WHERE id = %s AND case_id = %s",
                    (evidence_id, case_id)
                )
                conn.commit()
                cursor.execute(
                    "SELECT id, file_path, description, reviewed, uploaded_at FROM evidence_files WHERE id = %s",
                    (evidence_id,)
                )
                updated_evidence = cursor.fetchone()
        finally:
            conn.close()
        return jsonify({'evidence': updated_evidence, 'message': 'Evidence marked as reviewed'}), 200
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@app.route('/api/case/<int:case_id>/notes', methods=['PUT'])
def update_private_notes(case_id):
    decoded, error_response, status = validate_token()
    if error_response:
        return error_response, status
    try:
        lawyer_id = decoded['lawyer_id']
        data = request.json
        if not data or 'private_notes' not in data:
            return jsonify({'error': 'Private notes are required'}), 400
        private_notes = data['private_notes']
        conn = psycopg2.connect(**db_config)
        try:
            with conn.cursor() as cursor:
                cursor.execute("SELECT lawyer_id FROM cases WHERE id = %s", (case_id,))
                case = cursor.fetchone()
                if not case or case['lawyer_id'] != lawyer_id:
                    return jsonify({'error': 'Case not found or unauthorized'}), 403
                cursor.execute(
                    "UPDATE cases SET private_notes = %s WHERE id = %s",
                    (private_notes, case_id)
                )
                conn.commit()
        finally:
            conn.close()
        return jsonify({'message': 'Private notes updated successfully'}), 200
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@app.route('/api/case/<int:case_id>/messages', methods=['GET', 'POST', 'OPTIONS'])
def case_messages(case_id):
    if request.method == "OPTIONS":
        return jsonify({}), 200
    decoded, error_response, status = validate_token()
    if error_response:
        return error_response, status
    conn = psycopg2.connect(**db_config)
    try:
        with conn.cursor() as cursor:
            if request.method == 'GET':
                sql = """
                    SELECT cm.id, cm.sender, cm.message, cm.created_at
                    FROM case_messages cm
                    WHERE cm.case_id = %s
                    ORDER BY cm.created_at ASC
                """
                cursor.execute(sql, (case_id,))
                messages = cursor.fetchall()
                for message in messages:
                    if isinstance(message['created_at'], datetime):
                        message['created_at'] = message['created_at'].isoformat()
                return jsonify({'messages': messages}), 200
            elif request.method == 'POST':
                data = request.get_json()
                message = data.get('message')
                sender = 'lawyer' if 'lawyer_id' in decoded else 'client'
                if not message:
                    return jsonify({'error': 'Message content is required'}), 400
                if 'lawyer_id' in decoded:
                    cursor.execute("SELECT lawyer_id FROM cases WHERE id = %s", (case_id,))
                    case = cursor.fetchone()
                    if not case or case['lawyer_id'] != decoded['lawyer_id']:
                        return jsonify({'error': 'Case not found or unauthorized'}), 403
                else:
                    cursor.execute("SELECT client_id FROM cases WHERE id = %s", (case_id,))
                    case = cursor.fetchone()
                    if not case or case['client_id'] != decoded['client_id']:
                        return jsonify({'error': 'Case not found or unauthorized'}), 403
                sql = """
                    INSERT INTO case_messages (case_id, sender, message)
                    VALUES (%s, %s, %s)
                    RETURNING id, sender, message, created_at
                """
                cursor.execute(sql, (case_id, sender, message))
                new_message = cursor.fetchone()
                conn.commit()
                if new_message and isinstance(new_message['created_at'], datetime):
                    new_message['created_at'] = new_message['created_at'].isoformat()
                room = f"case_{case_id}"
                socketio.emit('new_message', new_message, room=room)
                return jsonify({'message': new_message}), 201
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({'error': f'Server error: {str(e)}'}), 500
    finally:
        conn.close()

@app.route('/api/client-cases', methods=['GET', 'OPTIONS'])
def client_cases():
    if request.method == "OPTIONS":
        return jsonify({}), 200
    decoded, error_response, status = validate_token()
    if error_response:
        return error_response, status
    try:
        client_id = decoded['client_id']
        conn = psycopg2.connect(**db_config)
        try:
            with conn.cursor() as cursor:
                sql = """
                    SELECT c.id, c.title, c.case_type, c.description, c.status, c.created_at, c.priority,
                           c.filing_date, c.jurisdiction, c.plaintiff_name, c.defendant_name,
                           l.name AS lawyer_name
                    FROM cases c
                    JOIN lawyers l ON c.lawyer_id = l.id
                    WHERE c.client_id = %s
                """
                cursor.execute(sql, (client_id,))
                cases = cursor.fetchall()
        finally:
            conn.close()
        return jsonify({'cases': cases}), 200
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@app.route('/api/client-case/<int:case_id>', methods=['GET'])
def get_client_case(case_id):
    decoded, error_response, status = validate_token()
    if error_response:
        return error_response, status
    try:
        client_id = decoded['client_id']
        conn = psycopg2.connect(**db_config)
        try:
            with conn.cursor() as cursor:
                sql = """
                    SELECT c.*, l.name AS lawyer_name
                    FROM cases c
                    JOIN lawyers l ON c.lawyer_id = l.id
                    WHERE c.id = %s AND c.client_id = %s
                """
                cursor.execute(sql, (case_id, client_id))
                case_data = cursor.fetchone()
                if not case_data:
                    return jsonify({'error': 'Case not found or unauthorized'}), 403
                cursor.execute(
                    "SELECT id, progress_event, event_date, created_at FROM case_timeline WHERE case_id = %s ORDER BY event_date ASC",
                    (case_id,)
                )
                timeline = cursor.fetchall()
                cursor.execute(
                    "SELECT id, file_path, uploaded_at FROM court_files WHERE case_id = %s",
                    (case_id,)
                )
                documents = cursor.fetchall()
                cursor.execute(
                    "SELECT id, file_path, description, reviewed, uploaded_at FROM evidence_files WHERE case_id = %s",
                    (case_id,)
                )
                evidence = cursor.fetchall()
                cursor.execute(
                    "SELECT id, sender, message, created_at FROM case_messages WHERE case_id = %s ORDER BY created_at ASC",
                    (case_id,)
                )
                messages = cursor.fetchall()
        finally:
            conn.close()
        return jsonify({
            'case': case_data,
            'timeline': timeline,
            'documents': documents,
            'evidence': evidence,
            'messages': messages
        }), 200
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({'error': f'Server error: {str(e)}'}), 500
    
def send_email(email, subject, body):
    try:
        msg = MIMEText(body)
        msg['Subject'] = subject
        msg['From'] = EMAIL_ADDRESS
        msg['To'] = email

        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
            server.login(EMAIL_ADDRESS, EMAIL_PASSWORD)
            server.sendmail(EMAIL_ADDRESS, email, msg.as_string())
        return True
    except Exception as e:
        print(f"Error sending email: {str(e)}")
        return False

@app.route('/api/lawyer-kyc', methods=['POST', 'OPTIONS'])
def submit_kyc():
    if request.method == "OPTIONS":
        return jsonify({}), 200
    decoded, error_response, status = validate_token()
    if error_response:
        return error_response, status
    try:
        lawyer_id = decoded['lawyer_id']
        data = request.form
        license_number = data.get('license_number')
        contact_number = data.get('contact_number')
        if not all([license_number, contact_number]):
            return jsonify({'error': 'License number and contact number are required'}), 400
        if 'identification_document' not in request.files:
            return jsonify({'error': 'Identification document is required'}), 400
        file = request.files['identification_document']
        if not allowed_file(file.filename):
            return jsonify({'error': 'Invalid file type. Allowed: png, jpg, jpeg, pdf'}), 400
        # Upload to Supabase Storage
        filename = secure_filename(file.filename)
        unique_filename = f"kyc/{lawyer_id}/{uuid.uuid4().hex}_{filename}"
        file_data = file.read()
        supabase.storage.from_('kyc-documents').upload(unique_filename, file_data, {
            'content-type': file.mimetype
        })
        file_url = supabase.storage.from_('kyc-documents').get_public_url(unique_filename)
        conn = psycopg2.connect(**db_config)
        try:
            with conn.cursor() as cursor:
                sql = """
                    INSERT INTO kyc_verifications (lawyer_id, license_number, contact_number, identification_document, kyc_status)
                    VALUES (%s, %s, %s, %s, %s)
                    RETURNING id
                """
                cursor.execute(sql, (lawyer_id, license_number, contact_number, file_url, 'submitted'))
                conn.commit()
        finally:
            conn.close()
        return jsonify({'message': 'KYC submitted successfully'}), 201
    except psycopg2.IntegrityError:
        return jsonify({'error': 'KYC already submitted for this lawyer'}), 409
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({'error': f'Server error: {str(e)}'}), 500
    
def generate_otp(length=6):
    return ''.join(random.choices(string.digits, k=length))

@app.route('/api/send-otp', methods=['POST'])
def send_otp():
    try:
        data = request.json
        email = data.get('email')
        if not email:
            return jsonify({'error': 'Email is required'}), 400
        otp = generate_otp()
        expires_at = datetime.utcnow() + timedelta(minutes=10)
        conn = psycopg2.connect(**db_config)
        try:
            with conn.cursor() as cursor:
                cursor.execute("DELETE FROM otps WHERE email = %s", (email,))
                cursor.execute(
                    "INSERT INTO otps (email, otp, expires_at) VALUES (%s, %s, %s)",
                    (email, otp, expires_at)
                )
                conn.commit()
        finally:
            conn.close()
        email_body = (
            f"Dear User,\n\n"
            f"Your OTP for registration is: {otp}\n"
            f"This OTP is valid for 10 minutes.\n\n"
            f"Best regards,\nLegalAid Team"
        )
        if send_email(email, 'LegalAid Registration OTP', email_body):
            return jsonify({'message': 'OTP sent successfully'}), 200
        else:
            return jsonify({'error': 'Failed to send OTP email'}), 500
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@app.route('/api/verify-otp', methods=['POST'])
def verify_otp():
    try:
        data = request.json
        email = data.get('email')
        otp = data.get('otp')
        if not all([email, otp]):
            return jsonify({'error': 'Email and OTP are required'}), 400
        conn = psycopg2.connect(**db_config)
        try:
            with conn.cursor() as cursor:
                cursor.execute(
                    "SELECT otp, expires_at FROM otps WHERE email = %s",
                    (email,)
                )
                otp_record = cursor.fetchone()
                if not otp_record:
                    return jsonify({'error': 'OTP not found or expired'}), 404
                if otp_record['otp'] != otp:
                    return jsonify({'error': 'Invalid OTP'}), 401
                if otp_record['expires_at'] < datetime.utcnow():
                    cursor.execute("DELETE FROM otps WHERE email = %s", (email,))
                    conn.commit()
                    return jsonify({'error': 'OTP has expired'}), 401
                cursor.execute("DELETE FROM otps WHERE email = %s", (email,))
                conn.commit()
        finally:
            conn.close()
        return jsonify({'message': 'OTP verified successfully'}), 200
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@app.route('/api/reset-password', methods=['POST'])
def reset_password():
    try:
        data = request.json
        email = data.get('email')
        new_password = data.get('new_password')
        otp = data.get('otp')
        if not all([email, new_password, otp]):
            return jsonify({'error': 'Email, new password, and OTP are required'}), 400
        if len(new_password) < 8:
            return jsonify({'error': 'New password must be at least 8 characters long'}), 400
        conn = psycopg2.connect(**db_config)
        try:
            with conn.cursor() as cursor:
                cursor.execute(
                    "SELECT otp, expires_at FROM otps WHERE email = %s",
                    (email,)
                )
                otp_record = cursor.fetchone()
                if not otp_record:
                    return jsonify({'error': 'OTP not found or expired'}), 404
                if otp_record['otp'] != otp:
                    return jsonify({'error': 'Invalid OTP'}), 401
                if otp_record['expires_at'] < datetime.utcnow():
                    cursor.execute("DELETE FROM otps WHERE email = %s", (email,))
                    conn.commit()
                    return jsonify({'error': 'OTP has expired'}), 401
                cursor.execute("SELECT id FROM lawyers WHERE email = %s", (email,))
                lawyer = cursor.fetchone()
                cursor.execute("SELECT id FROM clients WHERE email = %s", (email,))
                client = cursor.fetchone()
                if not lawyer and not client:
                    return jsonify({'error': 'User not found'}), 404
                hashed_bytes = hash_password(new_password)
                hashed_new_password = base64.b64encode(hashed_bytes).decode('utf-8')
                if lawyer:
                    cursor.execute(
                        "UPDATE lawyers SET password = %s WHERE id = %s",
                        (hashed_new_password, lawyer['id'])
                    )
                elif client:
                    cursor.execute(
                        "UPDATE clients SET password = %s WHERE id = %s",
                        (hashed_new_password, client['id'])
                    )
                cursor.execute("DELETE FROM otps WHERE email = %s", (email,))
                conn.commit()
        finally:
            conn.close()
        return jsonify({'message': 'Password reset successfully'}), 200
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@app.route('/api/reviews', methods=['GET', 'POST', 'OPTIONS'])
def reviews():
    if request.method == "OPTIONS":
        return jsonify({}), 200
    decoded, error_response, status = validate_token()
    if error_response and request.method == 'POST':
        return error_response, status
    try:
        conn = psycopg2.connect(**db_config)
        try:
            with conn.cursor() as cursor:
                if request.method == 'GET':
                    lawyer_id = request.args.get('lawyer_id')
                    if not lawyer_id:
                        return jsonify({'error': 'Lawyer ID is required'}), 400
                    sql = """
                        SELECT r.id, r.rating, r.comment, r.created_at, c.name AS client_name
                        FROM reviews r
                        JOIN clients c ON r.client_id = c.id
                        WHERE r.lawyer_id = %s
                        ORDER BY r.created_at DESC
                    """
                    cursor.execute(sql, (lawyer_id,))
                    reviews = cursor.fetchall()
                    return jsonify({'reviews': reviews}), 200
                elif request.method == 'POST':
                    client_id = decoded['client_id']
                    data = request.json
                    lawyer_id = data.get('lawyer_id')
                    rating = data.get('rating')
                    comment = data.get('comment', '')
                    if not all([lawyer_id, rating]):
                        return jsonify({'error': 'Lawyer ID and rating are required'}), 400
                    if not isinstance(rating, int) or rating < 1 or rating > 5:
                        return jsonify({'error': 'Rating must be an integer between 1 and 5'}), 400
                    sql = """
                        INSERT INTO reviews (lawyer_id, client_id, rating, comment)
                        VALUES (%s, %s, %s, %s)
                        RETURNING id
                    """
                    cursor.execute(sql, (lawyer_id, client_id, rating, comment))
                    review_id = cursor.fetchone()['id']
                    cursor.execute("""
                        SELECT AVG(rating) AS average_rating
                        FROM reviews
                        WHERE lawyer_id = %s
                    """, (lawyer_id,))
                    avg_rating = cursor.fetchone()['average_rating']
                    cursor.execute(
                        "UPDATE lawyers SET rating = %s WHERE id = %s",
                        (float(avg_rating), lawyer_id)
                    )
                    conn.commit()
                    cursor.execute("""
                        SELECT r.id, r.rating, r.comment, r.created_at, c.name AS client_name
                        FROM reviews r
                        JOIN clients c ON r.client_id = c.id
                        WHERE r.id = %s
                    """, (review_id,))
                    new_review = cursor.fetchone()
                    return jsonify({'review': new_review, 'message': 'Review submitted successfully'}), 201
        finally:
            conn.close()
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@socketio.on('join_case')
def on_join_case(data):
    case_id = data.get('case_id')
    if case_id:
        room = f"case_{case_id}"
        join_room(room)
        emit('joined', {'message': f'Joined case room {case_id}'}, room=room)

@socketio.on('leave_case')
def on_leave_case(data):
    case_id = data.get('case_id')
    if case_id:
        room = f"case_{case_id}"
        leave_room(room)
        emit('left', {'message': f'Left case room {case_id}'}, room=room)

@socketio.on('connect')
def on_connect():
    print('Client connected')

@socketio.on('disconnect')
def on_disconnect():
    print('Client disconnected')

def send_appointment_reminders():
    try:
        nepal_tz = pytz.timezone('Asia/Kathmandu')
        now = datetime.now(pytz.UTC)
        reminder_time = now + timedelta(hours=24)
        conn = psycopg2.connect(**db_config)
        try:
            with conn.cursor() as cursor:
                sql = """
                    SELECT a.id, a.appointment_date, c.email, c.name AS client_name, l.name AS lawyer_name
                    FROM appointments a
                    JOIN clients c ON a.client_id = c.id
                    JOIN lawyers l ON a.lawyer_id = l.id
                    WHERE a.status = 'confirmed'
                    AND a.reminder_sent = FALSE
                    AND a.appointment_date >= %s
                    AND a.appointment_date <= %s
                """
                cursor.execute(sql, (now, reminder_time))
                appointments = cursor.fetchall()
                for appt in appointments:
                    appointment_date = appt['appointment_date']
                    if appointment_date.tzinfo is None:
                        appointment_date = pytz.UTC.localize(appointment_date)
                    appointment_date_nepal = appointment_date.astimezone(nepal_tz)
                    formatted_date = appointment_date_nepal.strftime('%B %d, %Y at %I:%M %p %Z')
                    email_body = (
                        f"Dear {appt['client_name']},\n\n"
                        f"This is a reminder for your upcoming appointment with {appt['lawyer_name']}.\n"
                        f"Date and Time: {formatted_date}\n\n"
                        f"Please be prepared for your appointment.\n"
                        f"Best regards,\nLegalAid Team"
                    )
                    if send_email(appt['email'], 'LegalAid Appointment Reminder', email_body):
                        cursor.execute(
                            "UPDATE appointments SET reminder_sent = TRUE WHERE id = %s",
                            (appt['id'],)
                        )
                        conn.commit()
                    else:
                        print(f"Failed to send reminder email to {appt['email']}")
        finally:
            conn.close()
    except Exception as e:
        print(f"Error in sending appointment reminders: {str(e)}")

scheduler = BackgroundScheduler()
scheduler.add_job(send_appointment_reminders, 'interval', hours=1)
scheduler.start()

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=int(os.getenv('PORT', 5000)))

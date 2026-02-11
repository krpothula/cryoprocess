import React, { useState } from 'react';
import axios from 'axios';

function Login() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();
        const client_id = 'your-client-id';  // Replace with your OAuth2 client ID
        const client_secret = 'your-client-secret';  // Replace with your OAuth2 client secret
        const data = {
            grant_type: 'password',
            username: username,
            password: password,
            client_id: client_id,
            client_secret: client_secret,
        };

        try {
            const response = await axios.post('/oauth/token/', data);
            localStorage.setItem('access_token', response.data.access_token);
            alert('Login successful');
        } catch (error) {
            console.error(error);
            alert('Login failed');
        }
    };

    return (
        <div className="login-page">
            <h2>Login</h2>
            <form onSubmit={handleSubmit}>
                <div>
                    <label>Username:</label>
                    <input 
                        type="text" 
                        value={username}
                        onChange={(e) => setUsername(e.target.value)} 
                    />
                </div>
                <div>
                    <label>Password:</label>
                    <input 
                        type="password" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)} 
                    />
                </div>
                <button type="submit">Login</button>
            </form>
        </div>
    );
}

export default Login;

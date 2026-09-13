const inputSearch = document.getElementById('input-search');
const btnSearch = document.getElementById('btn-search');
const formSearch = document.getElementById('form-search');
const suggestionsBox = document.getElementById('suggestions');
const txtJam = document.getElementById('txt-jam');

let debounceTimer;
let dataJadwalSholat = null; // Menyimpan data jadwal aktif

// Jalankan saat halaman dimuat
window.addEventListener('DOMContentLoaded', () => {
    initJadwalSholat();
    mulaiJamDigital();
});

// Fitur Jam Realtime & Perhitungan Hitung Mundur
function mulaiJamDigital() {
    function updateJam() {
        const sekarang = new Date();
        const jam = String(sekarang.getHours()).padStart(2, '0');
        const menit = String(sekarang.getMinutes()).padStart(2, '0');
        const detik = String(sekarang.getSeconds()).padStart(2, '0');
        txtJam.innerText = `${jam}:${menit}:${detik}`;

        // Perbarui hitung mundur jika data jadwal sudah tersedia
        if (dataJadwalSholat) {
            hitungSisaWaktu(sekarang);
        }
    }
    updateJam();
    setInterval(updateJam, 1000);
}

// Menghitung sisa waktu menuju setiap jadwal sholat
function hitungSisaWaktu(sekarang) {
    const daftarWaktu = ['imsak', 'subuh', 'dzuhur', 'ashar', 'maghrib', 'isya'];
    let ditemukanSelanjutnya = false;

    daftarWaktu.forEach((waktuKey) => {
        const itemEl = document.querySelector(`.jadwal-item[data-waktu="${waktuKey}"]`);
        const statusEl = document.getElementById(`status-${waktuKey}`);
        const countdownEl = document.getElementById(`countdown-${waktuKey}`);
        
        const waktuStr = dataJadwalSholat[waktuKey];
        if (!waktuStr) return;

        const [jamSholat, menitSholat] = waktuStr.split(':').map(Number);
        const waktuSholatObj = new Date(sekarang);
        waktuSholatObj.setHours(jamSholat, menitSholat, 0, 0);

        const selisihMs = waktuSholatObj - sekarang;

        itemEl.classList.remove('next-prayer');

        if (selisihMs > 0) {
            // Waktu sholat belum lewat
            const totalDetik = Math.floor(selisihMs / 1000);
            const jam = Math.floor(totalDetik / 3600);
            const menit = Math.floor((totalDetik % 3600) / 60);
            const detik = totalDetik % 60;

            let formatCountdown = "-";
            if (jam > 0) {
                formatCountdown = `-${jam}j ${menit}m ${detik}s`;
            } else {
                formatCountdown = `-${menit}m ${detik}s`;
            }

            countdownEl.innerText = formatCountdown;

            if (!ditemukanSelanjutnya) {
                // Ini adalah waktu sholat berikutnya
                itemEl.classList.add('next-prayer');
                statusEl.innerText = "Sholat Selanjutnya";
                ditemukanSelanjutnya = true;
            } else {
                statusEl.innerText = "Mendatang";
            }
        } else {
            // Waktu sholat sudah lewat
            statusEl.innerText = "Sudah lewat";
            countdownEl.innerText = "";
        }
    });

    // Jika semua waktu sholat hari ini sudah lewat, maka sholat selanjutnya adalah Imsak/Subuh besok
    if (!ditemukanSelanjutnya) {
        const imsakEl = document.querySelector('.jadwal-item[data-waktu="imsak"]');
        const imsakStatus = document.getElementById('status-imsak');
        if (imsakEl) {
            imsakEl.classList.add('next-prayer');
            imsakStatus.innerText = "Besok Hari";
        }
    }
}

// Monitor input pencarian
inputSearch.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    btnSearch.disabled = query.length === 0;

    clearTimeout(debounceTimer);
    if (query.length < 2) {
        suggestionsBox.style.display = 'none';
        return;
    }

    debounceTimer = setTimeout(() => {
        cariSaranKota(query);
    }, 300);
});

// Submit form pencarian
formSearch.addEventListener('submit', (e) => {
    e.preventDefault();
    const query = inputSearch.value.trim();
    if (query.length > 0) {
        suggestionsBox.style.display = 'none';
        eksekusiPencarianKota(query);
    }
});

// Tutup saran jika klik di luar area
document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-container')) {
        suggestionsBox.style.display = 'none';
    }
});

function initJadwalSholat() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                
                const namaKota = await dapatkanNamaKota(lat, lon);
                if (namaKota) {
                    const idKota = await cariIdKota(namaKota);
                    if (idKota) {
                        pilihWilayah(idKota);
                    } else {
                        tampilkanError(`Kota ${namaKota} tidak didukung API.`);
                    }
                } else {
                    tampilkanError("Gagal mengenali nama wilayah koordinat.");
                }
            },
            (error) => {
                tampilkanError("Akses lokasi ditolak. Cari kota secara manual di atas.");
            }
        );
    } else {
        tampilkanError("Browser Anda tidak mendukung Geolocation. Gunakan pencarian.");
    }
}

async function dapatkanNamaKota(lat, lon) {
    try {
        const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=id`);
        const data = await response.json();
        const kota = data.city || data.locality || data.principalSubdivision || "";
        return kota.replace(/Kabupaten|Kota/g, "").trim();
    } catch (e) {
        return null;
    }
}

async function cariIdKota(namaKota) {
    try {
        const response = await fetch(`https://api.myquran.com/v2/sholat/kota/cari/${namaKota}`);
        const data = await response.json();
        return (data.status && data.data.length > 0) ? data.data[0].id : null;
    } catch (e) {
        return null;
    }
}

async function cariSaranKota(query) {
    try {
        const response = await fetch(`https://api.myquran.com/v2/sholat/kota/cari/${query}`);
        const data = await response.json();

        if (data.status && data.data.length > 0) {
            tampilkanSaran(data.data);
        } else {
            suggestionsBox.innerHTML = '<div class="suggestion-item">Kota tidak ditemukan</div>';
            suggestionsBox.style.display = 'block';
        }
    } catch (e) {
        console.error("Gagal mengambil data saran kota:", e);
    }
}

function tampilkanSaran(daftarKota) {
    suggestionsBox.innerHTML = '';
    daftarKota.forEach(kota => {
        const div = document.createElement('div');
        div.className = 'suggestion-item';
        div.innerText = kota.lokasi;
        div.addEventListener('click', () => {
            inputSearch.value = kota.lokasi;
            btnSearch.disabled = false;
            suggestionsBox.style.display = 'none';
            pilihWilayah(kota.id);
        });
        suggestionsBox.appendChild(div);
    });
    suggestionsBox.style.display = 'block';
}

async function eksekusiPencarianKota(query) {
    tampilkanLoading("Mencari wilayah...");
    const idKota = await cariIdKota(query);
    if (idKota) {
        pilihWilayah(idKota);
    } else {
        tampilkanError(`Wilayah "${query}" tidak ditemukan.`);
    }
}

function pilihWilayah(idKota) {
    tampilkanLoading("Mengambil data jadwal sholat...");
    const hariIni = new Date().toISOString().split('T')[0];
    renderJadwal(idKota, hariIni);
}

async function renderJadwal(idKota, tanggal) {
    try {
        const response = await fetch(`https://api.myquran.com/v2/sholat/jadwal/${idKota}/${tanggal}`);
        const resData = await response.json();
        
        if (resData.status) {
            const data = resData.data;
            const jadwal = data.jadwal;
            
            // Simpan data jadwal global untuk dihitung hitung mundurnya
            dataJadwalSholat = jadwal;

            document.getElementById('txt-lokasi').innerText = data.lokasi;
            document.getElementById('txt-tanggal').innerText = jadwal.tanggal;

            document.getElementById('imsak').innerText = jadwal.imsak;
            document.getElementById('subuh').innerText = jadwal.subuh;
            document.getElementById('dzuhur').innerText = jadwal.dzuhur;
            document.getElementById('ashar').innerText = jadwal.ashar;
            document.getElementById('maghrib').innerText = jadwal.maghrib;
            document.getElementById('isya').innerText = jadwal.isya;

            // Jalankan perhitungan awal secara langsung
            hitungSisaWaktu(new Date());

            document.getElementById('txt-loading').style.display = 'none';
            document.getElementById('jadwal-container').style.display = 'flex';
        } else {
            tampilkanError("Jadwal gagal dimuat dari server.");
        }
    } catch (error) {
        tampilkanError("Terjadi gangguan jaringan internet.");
    }
}

function tampilkanLoading(pesan) {
    document.getElementById('txt-loading').style.display = 'block';
    document.getElementById('txt-loading').style.color = '#2980b9';
    document.getElementById('txt-loading').innerText = pesan;
    document.getElementById('jadwal-container').style.display = 'none';
}

function tampilkanError(pesan) {
    document.getElementById('txt-loading').style.display = 'block';
    document.getElementById('txt-loading').style.color = '#e74c3c';
    document.getElementById('txt-loading').innerText = pesan;
    document.getElementById('txt-lokasi').innerText = "Gagal memuat lokasi";
}
<script>


const lines = [
"Подключение к архиву...",
"Проверка доступа...",
"Поиск материалов...",
"Доступ разрешён."
];

let i = 0;

const text = document.getElementById("loader-text");

function loader(){

    if(i < lines.length){

        text.innerHTML += lines[i] + "<br>";

        i++;

        setTimeout(loader,800);

    }else{

        setTimeout(()=>{
            document.getElementById("loader").style.display="none";
        },1000);
    }
}

loader();


const files = [
"Запись №42",
"Фотография без даты",
"Дело №011",
"Неизвестный радиосигнал",
"Потерянный дневник",
"Засекреченный отчёт"
];

document.getElementById("randomTitle").innerText =
files[Math.floor(Math.random()*files.length)];

/* ПАСХАЛКА */

let clicks = 0;

document.getElementById("secretLogo").addEventListener("click",()=>{

    clicks++;

    if(clicks === 7){

        alert(
`СКРЫТЫЙ АРХИВ ОБНАРУЖЕН

Дело №000 разблокировано.`
        );

        clicks = 0;
    }
});

</script>
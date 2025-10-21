# Generated migration to remove unique constraint
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0005_cryptoasset'),
    ]

    operations = [
        # Remove the unique_together constraint
        migrations.AlterUniqueTogether(
            name='cryptoasset',
            unique_together=set(),
        ),
        # Add ordering and index
        migrations.AlterModelOptions(
            name='cryptoasset',
            options={'ordering': ['-purchase_date', '-created_at']},
        ),
        migrations.AddIndex(
            model_name='cryptoasset',
            index=models.Index(fields=['user', 'symbol'], name='core_crypto_user_sy_idx'),
        ),
    ]